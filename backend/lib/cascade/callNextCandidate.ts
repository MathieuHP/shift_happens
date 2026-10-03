import { optionalEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { insertEvent } from "@/lib/events/insertEvent";
import type { AbsenceCase, CallAttempt, Employee, RestaurantAccount } from "@/lib/types";
import { checkContactPolicy } from "@/lib/voice/contactPolicy";
import { getVoiceProvider, getVoiceRecipient } from "@/lib/voice/getProvider";

export async function callNextCandidate(absenceCaseId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: absenceCase, error: caseError } = await supabase
    .from("absence_cases")
    .select("*")
    .eq("id", absenceCaseId)
    .single<AbsenceCase>();
  if (caseError) throw caseError;

  if (absenceCase.status === "resolved" || absenceCase.status === "unresolved") {
    return { status: absenceCase.status, attempted: false };
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("absence_case_id", absenceCaseId);
  if (attemptsError) throw attemptsError;

  const previousAttempts = (attempts ?? []) as CallAttempt[];
  if (previousAttempts.some((attempt) => attempt.status === "calling")) {
    return { status: "calling", attempted: false };
  }
  const attemptedEmployeeIds = new Set(previousAttempts.map((attempt) => attempt.employee_id));

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurant_accounts")
    .select("timezone")
    .eq("id", absenceCase.restaurant_account_id)
    .single<Pick<RestaurantAccount, "timezone">>();
  if (restaurantError) throw restaurantError;

  let candidate: Employee | null = null;
  for (const employeeId of absenceCase.candidate_ids) {
    if (attemptedEmployeeIds.has(employeeId)) continue;

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single<Employee>();
    if (employeeError) throw employeeError;

    const policy = checkContactPolicy({
      consentAt: employee.contact_consent_at,
      now: new Date(),
      timeZone: restaurant.timezone,
      windowStart: optionalEnv("CONTACT_WINDOW_START") ?? "09:00",
      windowEnd: optionalEnv("CONTACT_WINDOW_END") ?? "20:00",
    });
    if (!policy.allowed) {
      await insertEvent(supabase, {
        absenceCaseId,
        type: "candidate_skipped",
        message: `${employee.name} was skipped: ${policy.reason}.`,
        payload: { employeeId: employee.id, reason: policy.reason },
      });
      continue;
    }
    candidate = employee;
    break;
  }

  if (!candidate) {
    const { error } = await supabase
      .from("absence_cases")
      .update({ status: "unresolved" })
      .eq("id", absenceCaseId);
    if (error) throw error;

    await insertEvent(supabase, {
      absenceCaseId,
      type: "case_unresolved",
      message: "No eligible replacement accepted the shift.",
    });
    return { status: "unresolved", attempted: false };
  }

  const provider = getVoiceProvider();
  const idempotencyKey = `${absenceCase.id}:${candidate.id}`;
  const { data: attempt, error: attemptError } = await supabase
    .from("call_attempts")
    .insert({
      absence_case_id: absenceCaseId,
      employee_id: candidate.id,
      idempotency_key: idempotencyKey,
      status: "calling",
      voice_provider: process.env.VOICE_ENABLED === "true" ? "elevenlabs" : "simulated",
    })
    .select("*")
    .single<CallAttempt>();
  if (attemptError) throw attemptError;

  const { error: updateCaseError } = await supabase
    .from("absence_cases")
    .update({ status: "calling" })
    .eq("id", absenceCaseId);
  if (updateCaseError) throw updateCaseError;

  await insertEvent(supabase, {
    absenceCaseId,
    type: "call_started",
    message: `Calling ${candidate.name} for the vacant shift.`,
    payload: { employeeId: candidate.id, attemptId: attempt.id },
  });

  // The attempt is committed before the provider request. If the request times out,
  // it remains active and must be reconciled before another attempt is created.
  const call = await provider.placeCall({
    idempotencyKey,
    toNumber: getVoiceRecipient(candidate.phone),
  });

  const { error: identifiersError } = await supabase
    .from("call_attempts")
    .update({
      twilio_call_sid: call.callSid,
      voice_conversation_id: call.conversationId,
    })
    .eq("id", attempt.id);
  if (identifiersError) throw identifiersError;

  return {
    status: "calling",
    attempted: true,
    mode: call.mode,
    callSid: call.callSid,
    conversationId: call.conversationId,
  };
}
