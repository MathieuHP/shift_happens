import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { insertEvent } from "@/lib/events/insertEvent";
import type { AbsenceCase, CallAttempt, Employee, Shift } from "@/lib/types";

import { callNextCandidate } from "./callNextCandidate";

export async function handleCandidateResponse(input: {
  attemptId: string;
  accepted: boolean;
  rawResponse?: string | null;
}) {
  const supabase = createSupabaseServiceClient();

  const { data: attempt, error: attemptError } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("id", input.attemptId)
    .single<CallAttempt>();

  if (attemptError) {
    throw attemptError;
  }

  const { data: absenceCase, error: caseError } = await supabase
    .from("absence_cases")
    .select("*")
    .eq("id", attempt.absence_case_id)
    .single<AbsenceCase>();

  if (caseError) {
    throw caseError;
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", attempt.employee_id)
    .single<Employee>();

  if (employeeError) {
    throw employeeError;
  }

  if (!input.accepted) {
    const { error } = await supabase
      .from("call_attempts")
      .update({ status: "declined", response_text: input.rawResponse ?? null })
      .eq("id", input.attemptId);

    if (error) {
      throw error;
    }

    await insertEvent(supabase, {
      absenceCaseId: absenceCase.id,
      type: "call_declined",
      message: `${employee.name} declined the shift.`,
      payload: { employeeId: employee.id, attemptId: input.attemptId },
    });

    return callNextCandidate(absenceCase.id);
  }

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", absenceCase.shift_id)
    .single<Shift>();

  if (shiftError) {
    throw shiftError;
  }

  const { error: shiftUpdateError } = await supabase
    .from("shifts")
    .update({
      employee_id: employee.id,
      status: "covered",
      replacement_for_employee_id: absenceCase.absent_employee_id,
    })
    .eq("id", shift.id);

  if (shiftUpdateError) {
    throw shiftUpdateError;
  }

  const { error: attemptUpdateError } = await supabase
    .from("call_attempts")
    .update({ status: "accepted", response_text: input.rawResponse ?? null })
    .eq("id", input.attemptId);

  if (attemptUpdateError) {
    throw attemptUpdateError;
  }

  const { error: caseUpdateError } = await supabase
    .from("absence_cases")
    .update({ status: "resolved", accepted_employee_id: employee.id })
    .eq("id", absenceCase.id);

  if (caseUpdateError) {
    throw caseUpdateError;
  }

  await insertEvent(supabase, {
    absenceCaseId: absenceCase.id,
    type: "replacement_accepted",
    message: `${employee.name} accepted the shift.`,
    payload: { employeeId: employee.id, shiftId: shift.id },
  });

  await insertEvent(supabase, {
    absenceCaseId: absenceCase.id,
    type: "case_resolved",
    message: `${employee.name} will cover the shift.`,
    payload: { employeeId: employee.id, shiftId: shift.id },
  });

  return { status: "resolved", acceptedEmployeeId: employee.id };
}
