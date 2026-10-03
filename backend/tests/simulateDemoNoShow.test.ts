import { describe, expect, it } from "vitest";

import { setDemoStateFromCascade } from "@/lib/demo/demoState";
import { simulateDemoNoShow } from "@/lib/demo/simulateDemoNoShow";

describe("simulateDemoNoShow", () => {
  it("returns an automated no-show replacement cascade", () => {
    const result = simulateDemoNoShow();

    expect(result.trigger).toBe("no_show");
    expect(result.absentEmployee).toBe("Jade Dubois");
    expect(result.replacementEmployee).toBe("Sacha Noel");
    expect(result.timeline.map((event) => event.type)).toEqual([
      "checkin_window_opened",
      "no_checkin_detected",
      "employee_call_started",
      "employee_no_answer",
      "shift_vacant",
      "candidate_list_created",
      "call_started",
      "replacement_accepted",
      "case_resolved",
    ]);
  });

  it("updates the demo dashboard state for a no-show", () => {
    const state = setDemoStateFromCascade(simulateDemoNoShow());

    expect(state.currentCase?.trigger).toBe("no_show");
    expect(state.currentCase?.replacementEmployee).toBe("Sacha Noel");
    expect(state.schedule[0]).toMatchObject({
      status: "covered",
      employeeName: "Sacha Noel",
      replacementFor: "Jade Dubois",
    });
  });
});
