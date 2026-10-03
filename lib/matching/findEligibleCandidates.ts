import type { SupabaseClient } from "@supabase/supabase-js";
import { addHours, areIntervalsOverlapping, parseISO } from "date-fns";

import type { Candidate, Employee, Shift } from "@/lib/types";

const MIN_REST_HOURS = 8;

export async function findEligibleCandidates(
  supabase: SupabaseClient,
  input: {
    shift: Shift;
    absentEmployeeId: string;
  },
) {
  const { data: employees, error: employeesError } = (await supabase
    .from("employees")
    .select("*")
    .eq("active", true)) as { data: Employee[] | null; error: Error | null };

  if (employeesError) {
    throw employeesError;
  }

  const { data: shifts, error: shiftsError } = (await supabase
    .from("shifts")
    .select("*")) as { data: Shift[] | null; error: Error | null };

  if (shiftsError) {
    throw shiftsError;
  }

  const targetStart = parseISO(input.shift.starts_at);
  const targetEnd = parseISO(input.shift.ends_at);

  return (employees ?? [])
    .filter((employee) => employee.id !== input.absentEmployeeId)
    .filter((employee) => {
      return (
        employee.role === input.shift.role ||
        employee.skills.includes(input.shift.skill_required)
      );
    })
    .filter((employee) => {
      const assignedShifts = (shifts ?? []).filter(
        (shift) => shift.employee_id === employee.id && shift.status !== "cancelled",
      );

      const overlaps = assignedShifts.some((shift) => {
        return areIntervalsOverlapping(
          { start: targetStart, end: targetEnd },
          { start: parseISO(shift.starts_at), end: parseISO(shift.ends_at) },
        );
      });

      if (overlaps) {
        return false;
      }

      return assignedShifts.every((shift) => {
        const shiftEnd = parseISO(shift.ends_at);
        return addHours(shiftEnd, MIN_REST_HOURS) <= targetStart;
      });
    })
    .map<Candidate>((employee) => ({
      ...employee,
      score: 100 - employee.priority,
      reason: "Matching role/skill, no overlap, legal rest window satisfied",
    }))
    .sort((a, b) => b.score - a.score);
}
