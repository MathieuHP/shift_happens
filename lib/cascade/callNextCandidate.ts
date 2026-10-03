import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  getPublicBaseUrl,
  getTwilioClient,
  getTwilioFromNumber,
  hasTwilioConfig,
} from "@/lib/twilio/client";
import { insertEvent } from "@/lib/events/insertEvent";
import type { AbsenceCase, CallAttempt, Employee } from "@/lib/types";

export async function callNextCandidate(absenceCaseId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: absenceCase, error: caseError } = await supabase
    .from("absence_cases")
    .select("*")
    .eq("id", absenceCaseId)
    .single<AbsenceCase>();

  if (caseError) {
    throw caseError;
  }

  if (absenceCase.status === "resolved" || absenceCase.status === "unresolved") {
    return { status: absenceCase.status, attempted: false };
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("absence_case_id", absenceCaseId);

  if (attemptsError) {
    throw attemptsError;
  }

  const attemptedEmployeeIds = new Set(
    ((attempts ?? []) as CallAttempt[]).map((attempt) => attempt.employee_id),
  );
  const nextEmployeeId = absenceCase.candidate_ids.find(
    (employeeId) => !attemptedEmployeeIds.has(employeeId),
  );

  if (!nextEmployeeId) {
    const { error } = await supabase
      .from("absence_cases")
      .update({ status: "unresolved" })
      .eq("id", absenceCaseId);

    if (error) {
      throw error;
    }

    await insertEvent(supabase, {
      absenceCaseId,
      type: "case_unresolved",
      message: "No eligible replacement accepted the shift.",
    });

    return { status: "unresolved", attempted: false };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", nextEmployeeId)
    .single<Employee>();

  if (employeeError) {
    throw employeeError;
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("call_attempts")
    .insert({
      absence_case_id: absenceCaseId,
      employee_id: employee.id,
      status: "calling",
    })
    .select("*")
    .single<CallAttempt>();

  if (attemptError) {
    throw attemptError;
  }

  const { error: updateCaseError } = await supabase
    .from("absence_cases")
    .update({ status: "calling" })
    .eq("id", absenceCaseId);

  if (updateCaseError) {
    throw updateCaseError;
  }

  await insertEvent(supabase, {
    absenceCaseId,
    type: "call_started",
    message: `Calling ${employee.name} for the vacant shift.`,
    payload: { employeeId: employee.id, attemptId: attempt.id },
  });

  if (!hasTwilioConfig()) {
    await insertEvent(supabase, {
      absenceCaseId,
      type: "demo_call_skipped",
      message: `Twilio env is missing. Demo would call ${employee.name}.`,
      payload: { employeeId: employee.id, attemptId: attempt.id },
    });

    return { status: "calling", attempted: true, twilioSkipped: true };
  }

  const baseUrl = getPublicBaseUrl();
  const client = getTwilioClient();
  const call = await client.calls.create({
    to: employee.phone,
    from: getTwilioFromNumber(),
    url: `${baseUrl}/api/voice/twiml?attemptId=${attempt.id}`,
    statusCallback: `${baseUrl}/api/voice/status?attemptId=${attempt.id}`,
    statusCallbackEvent: ["completed"],
    statusCallbackMethod: "POST",
  });

  const { error: sidError } = await supabase
    .from("call_attempts")
    .update({ twilio_call_sid: call.sid })
    .eq("id", attempt.id);

  if (sidError) {
    throw sidError;
  }

  return { status: "calling", attempted: true, twilioCallSid: call.sid };
}
