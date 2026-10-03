import { describe, expect, it } from "vitest";
import { buildOfferDynamicVariables } from "../lib/voice/offerVariables";

describe("buildOfferDynamicVariables", () => {
  it("formats server-owned shift and pay details for the agent", () => {
    expect(buildOfferDynamicVariables({
      restaurantName: "ShiftSaver Bistro",
      employeeName: "Sarah Lee",
      role: "server",
      startsAt: "2026-10-04T08:00:00.000Z",
      endsAt: "2026-10-04T16:00:00.000Z",
      hourlyRate: 16,
      responseDeadline: new Date("2026-10-04T07:00:45.000Z"),
      timeZone: "Europe/Brussels",
      managerApprovalRequired: true,
    })).toMatchObject({
      restaurant_name: "ShiftSaver Bistro",
      employee_first_name: "Sarah",
      role: "server",
      shift_start: "10:00",
      shift_end: "18:00",
      hourly_rate: "16,00",
      total_amount: "128,00",
      manager_approval_required: "true",
    });
  });
});
