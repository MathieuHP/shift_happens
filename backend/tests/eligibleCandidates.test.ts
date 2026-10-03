import { describe, expect, it } from "vitest";

import { getEligibleCandidates } from "@/lib/matching/eligibleCandidates";
import type { Employee, Shift } from "@/lib/types";

const restaurantId = "restaurant-1";

function employee(input: Partial<Employee> & Pick<Employee, "id" | "name">): Employee {
  return {
    restaurant_account_id: restaurantId,
    phone: `+1555${input.id}`,
    role: "server",
    skills: ["server"],
    active: true,
    priority: 50,
    ...input,
  };
}

function shift(input: Partial<Shift> & Pick<Shift, "id">): Shift {
  return {
    restaurant_account_id: restaurantId,
    employee_id: null,
    role: "server",
    skill_required: "server",
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
