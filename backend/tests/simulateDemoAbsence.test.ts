import { describe, expect, it } from "vitest";

import { simulateDemoAbsence } from "@/lib/demo/simulateDemoAbsence";

describe("simulateDemoAbsence", () => {
  it("returns a complete local demo cascade", () => {
    const result = simulateDemoAbsence({
      fromPhone: "+15550001001",
      body: "I am sick",
    });

    expect(result.simulated).toBe(true);
    expect(result.absentEmployee).toBe("Paul Martin");
    expect(result.cascade.status).toBe("resolved");
    expect(result.managerNotification).toContain("Thomas Reed");
    expect(result.timeline.map((event) => event.type)).toContain("replacement_accepted");
  });
});
