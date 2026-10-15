import { addHours, areIntervalsOverlapping, parseISO } from "date-fns";

import type { Candidate, Employee, Shift } from "@/lib/types";

// Repos minimum entre deux shifts (décision du 2026-10-03, voir documentation/09-open-decisions.md).
// À terme : paramètre du restaurant.
const MIN_REST_HOURS = 11;

export function getEligibleCandidates(input: {
  employees: Employee[];
  shifts: Shift[];
  shift: Shift;
  absentEmployeeId: string;
}) {
  const targetStart = parseISO(input.shift.starts_at);
  const targetEnd = parseISO(input.shift.ends_at);

  return input.employees
    .filter((employee) => employee.active)
    .filter((employee) => employee.id !== input.absentEmployeeId)
    // Seuls les employés qui ont accepté d'être contactés reçoivent des offres.
    .filter((employee) => employee.contact_consent_at !== null)
    .filter((employee) => {
      return (
        employee.role === input.shift.role ||
        employee.skills.includes(input.shift.skill_required)
      );
    })
    .filter((employee) => {
      const assignedShifts = input.shifts.filter(
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

      // Le repos compte dans les deux sens : après un shift précédent, et avant un shift suivant.
      return assignedShifts.every((shift) => {
        const restedBefore = addHours(parseISO(shift.ends_at), MIN_REST_HOURS) <= targetStart;
        const restedAfter = addHours(targetEnd, MIN_REST_HOURS) <= parseISO(shift.starts_at);
        return restedBefore || restedAfter;
      });
    })
    .map<Candidate>((employee) => ({
      ...employee,
      score: 100 - employee.priority,
      reason: "Matching role/skill, no overlap, 11 h rest before and after satisfied",
    }))
    .sort((a, b) => b.score - a.score);
}
