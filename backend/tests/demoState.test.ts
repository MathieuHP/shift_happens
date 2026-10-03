import { beforeEach, describe, expect, it } from "vitest";

import {
  getDemoState,
  resetDemoState,
  setDemoStateFromAbsence,
} from "@/lib/demo/demoState";
import { simulateDemoAbsence } from "@/lib/demo/simulateDemoAbsence";

describe("demoState", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("starts with the scheduled demo shift", () => {
    const state = getDemoState();

    expect(state.status).toBe("idle");
    expect(state.currentCase).toBeNull();
    expect(state.schedule[0]).toMatchObject({
      status: "scheduled",
      employeeName: "Paul Martin",
      replacementFor: null,
    });
  });

  it("updates dashboard state after a simulated absence", () => {
    const result = simulateDemoAbsence({
      fromPhone: "+15550001001",
      body: "I am sick",
    });

    const state = setDemoStateFromAbsence(result);

    expect(state.status).toBe("resolved");
    expect(state.currentCase?.absentEmployee).toBe("Paul Martin");
    expect(state.currentCase?.replacementEmployee).toBe("Thomas Reed");
    expect(state.roster.find((employee) => employee.name === "Paul Martin")?.status).toBe(
      "absent",
    );
    expect(state.schedule[0]).toMatchObject({
      status: "covered",
      employeeName: "Thomas Reed",
      replacementFor: "Paul Martin",
    });
    expect(state.timeline.at(-1)?.type).toBe("case_resolved");
  });
});
