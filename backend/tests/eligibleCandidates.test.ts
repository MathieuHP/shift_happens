import { describe, expect, it } from "vitest";

import { getEligibleCandidates } from "@/lib/matching/eligibleCandidates";
import type { Employee, Shift } from "@/lib/types";

const restaurantId = "restaurant-1";

function employee(input: Partial<Employee> & Pick<Employee, "id" | "name">): Employee {
  return {
    restaurant_account_id: restaurantId,
    phone: `+1555${input.id}`,
    role: "salle",
    skills: ["salle"],
    active: true,
    priority: 50,
    contact_consent_at: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

function shift(input: Partial<Shift> & Pick<Shift, "id">): Shift {
  return {
    restaurant_account_id: restaurantId,
    employee_id: null,
    role: "salle",
    skill_required: "salle",
    starts_at: "2026-10-04T08:00:00.000Z",
    ends_at: "2026-10-04T16:00:00.000Z",
    status: "scheduled",
    ...input,
  };
}

describe("getEligibleCandidates", () => {
  it("filters absent, inactive, overlapping, and insufficient-rest employees", () => {
    const targetShift = shift({ id: "target", employee_id: "absent" });
    const candidates = getEligibleCandidates({
      absentEmployeeId: "absent",
      shift: targetShift,
      employees: [
        employee({ id: "absent", name: "Paul" }),
        employee({ id: "inactive", name: "Inactive", active: false }),
        employee({ id: "overlap", name: "Overlap" }),
        employee({ id: "tired", name: "Tired" }),
        employee({ id: "eligible", name: "Eligible", priority: 10 }),
      ],
      shifts: [
        targetShift,
        shift({
          id: "overlap-shift",
          employee_id: "overlap",
          starts_at: "2026-10-04T10:00:00.000Z",
          ends_at: "2026-10-04T12:00:00.000Z",
        }),
        shift({
          id: "late-shift",
          employee_id: "tired",
          starts_at: "2026-10-03T22:00:00.000Z",
          ends_at: "2026-10-04T02:00:00.000Z",
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["eligible"]);
  });

  it("keeps employees who only have shifts well after the target shift", () => {
    const targetShift = shift({ id: "target", employee_id: "absent" });
    const candidates = getEligibleCandidates({
      absentEmployeeId: "absent",
      shift: targetShift,
      employees: [
        employee({ id: "absent", name: "Paul" }),
        employee({ id: "next-week", name: "Next week" }),
        employee({ id: "tomorrow", name: "Tomorrow" }),
      ],
      shifts: [
        targetShift,
        // starts the next week
        shift({
          id: "next-week-shift",
          employee_id: "next-week",
          starts_at: "2026-10-11T08:00:00.000Z",
          ends_at: "2026-10-11T16:00:00.000Z",
        }),
        // starts 17 h after the target shift ends (target ends at 16:00)
        shift({
          id: "tomorrow-shift",
          employee_id: "tomorrow",
          starts_at: "2026-10-05T09:00:00.000Z",
          ends_at: "2026-10-05T17:00:00.000Z",
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.id).sort()).toEqual(["next-week", "tomorrow"]);
  });

  it("excludes employees whose next shift starts less than 11 h after the target shift ends", () => {
    const targetShift = shift({ id: "target", employee_id: "absent" });
    const candidates = getEligibleCandidates({
      absentEmployeeId: "absent",
      shift: targetShift,
      employees: [
        employee({ id: "absent", name: "Paul" }),
        employee({ id: "too-close", name: "Too close" }),
        employee({ id: "just-enough", name: "Just enough" }),
      ],
      shifts: [
        targetShift,
        // target ends 16:00 -> 02:59 is only 10 h 59 min later
        shift({
          id: "too-close-shift",
          employee_id: "too-close",
          starts_at: "2026-10-05T02:59:00.000Z",
          ends_at: "2026-10-05T10:00:00.000Z",
        }),
        // exactly 11 h later
        shift({
          id: "just-enough-shift",
          employee_id: "just-enough",
          starts_at: "2026-10-05T03:00:00.000Z",
          ends_at: "2026-10-05T10:00:00.000Z",
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["just-enough"]);
  });

  it("excludes employees who have not consented to be contacted", () => {
    const candidates = getEligibleCandidates({
      absentEmployeeId: "absent",
      shift: shift({ id: "target", employee_id: "absent" }),
      employees: [
        employee({ id: "absent", name: "Paul" }),
        employee({ id: "no-consent", name: "No consent", contact_consent_at: null }),
        employee({ id: "consented", name: "Consented" }),
      ],
      shifts: [],
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["consented"]);
  });

  it("orders eligible employees by priority", () => {
    const candidates = getEligibleCandidates({
      absentEmployeeId: "absent",
      shift: shift({ id: "target", employee_id: "absent" }),
      employees: [
        employee({ id: "absent", name: "Paul" }),
        employee({ id: "second", name: "Second", priority: 20 }),
        employee({ id: "first", name: "First", priority: 5 }),
      ],
      shifts: [],
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["first", "second"]);
  });
});
