import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { insertEvent } from "@/lib/events/insertEvent";
import { findEligibleCandidates } from "@/lib/matching/findEligibleCandidates";
import { normalizePhone } from "@/lib/phone/normalizePhone";
import type { AbsenceCase, Employee, Shift } from "@/lib/types";

import { callNextCandidate } from "./callNextCandidate";

export async function handleAbsenceMessage(input: {
  fromPhone: string;
  body: string;
}) {
  const supabase = createSupabaseServiceClient();
  const fromPhone = normalizePhone(input.fromPhone);

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("*");

  if (employeesError) {
    throw employeesError;
  }

  const absentEmployee = ((employees ?? []) as Employee[]).find(
    (employee) => normalizePhone(employee.phone) === fromPhone,
  );

  if (!absentEmployee) {
    throw new Error(`No employee found for phone ${input.fromPhone}`);
  }

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", absentEmployee.id)
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .single<Shift>();

  if (shiftError) {
    throw shiftError;
  }

  const candidates = await findEligibleCandidates(supabase, {
    shift,
    absentEmployeeId: absentEmployee.id,
  });

  const { data: absenceCase, error: caseError } = await supabase
    .from("absence_cases")
    .insert({
      absent_employee_id: absentEmployee.id,
      shift_id: shift.id,
      status: "open",
      inbound_message: input.body,
      candidate_ids: candidates.map((candidate) => candidate.id),
    })
    .select("*")
    .single<AbsenceCase>();

  if (caseError) {
    throw caseError;
  }

  const { error: shiftUpdateError } = await supabase
    .from("shifts")
    .update({ status: "vacant", employee_id: null })
    .eq("id", shift.id);

  if (shiftUpdateError) {
    throw shiftUpdateError;
  }

  await insertEvent(supabase, {
    absenceCaseId: absenceCase.id,
    type: "absence_reported",
    message: `${absentEmployee.name} reported they cannot work the shift.`,
    payload: { employeeId: absentEmployee.id, shiftId: shift.id, body: input.body },
  });

  await insertEvent(supabase, {
    absenceCaseId: absenceCase.id,
    type: "shift_vacant",
    message: `${shift.role} shift is now vacant.`,
    payload: { shiftId: shift.id },
  });

  await insertEvent(supabase, {
    absenceCaseId: absenceCase.id,
    type: "candidate_list_created",
    message: `Found ${candidates.length} eligible replacement candidates.`,
    payload: { candidateIds: candidates.map((candidate) => candidate.id) },
  });

  const cascade = await callNextCandidate(absenceCase.id);

  return {
    absenceCaseId: absenceCase.id,
    absentEmployee,
    shift,
    candidates,
    cascade,
  };
}
