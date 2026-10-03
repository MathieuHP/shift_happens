import { beforeEach, describe, expect, it } from "vitest";

import {
  approveReplacement,
  findReplacement,
  listOffersForEmployee,
  listReports,
  listShiftsForEmployee,
  rejectReplacement,
  reportShift,
  respondToOffer,
  updateSettings,
} from "@/lib/inapp/service";
import { createSeedState } from "@/lib/inapp/state";
import { DomainError, type AppState } from "@/lib/inapp/types";

// 2026-10-03 12:00 UTC -> les shifts de démo sont demain (04/10) et après-demain (05/10)
const now = new Date("2026-10-03T12:00:00.000Z");
let state: AppState;

beforeEach(() => {
  state = createSeedState(now);
});

// Jade a le shift bar de demain soir (shift-5). Les remplaçants éligibles : Eli (bar) et Sacha (skill bar).
function jadeReportsAbsence() {
  return reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
}

function offerFor(employeeId: string) {
  const offer = state.offers.find((o) => o.employee_id === employeeId);
  if (!offer) throw new Error("no offer for " + employeeId);
  return offer;
}

describe("reportShift", () => {
  it("creates an open absence report without touching the shift", () => {
    const { report, created } = jadeReportsAbsence();

    expect(created).toBe(true);
    expect(report.status).toBe("open");
    expect(state.shifts.find((s) => s.id === "shift-5")).toMatchObject({ employee_id: "jade", status: "scheduled" });
  });

  it("is idempotent: reporting twice creates one report", () => {
    jadeReportsAbsence();
    const second = jadeReportsAbsence();

    expect(second.created).toBe(false);
    expect(state.reports).toHaveLength(1);
  });

  it("records a delay without starting any outreach", () => {
    const { report } = reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "delay", eta: "18:20" }, now);

    expect(report).toMatchObject({ status: "delay_noted", eta: "18:20" });
    expect(state.offers).toHaveLength(0);
  });

  it("rejects someone else's shift and shifts that already started", () => {
    expect(() => reportShift(state, { employeeId: "tom", shiftId: "shift-5", kind: "absence" }, now)).toThrow(DomainError);
    expect(() =>
      reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, new Date("2026-10-04T19:00:00.000Z")),
    ).toThrow(/déjà commencé/);
  });
});

describe("findReplacement", () => {
  it("vacates the shift and sends offers to eligible people only", () => {
    const { report } = jadeReportsAbsence();
    const result = findReplacement(state, report.id, now);

    expect(result.report.status).toBe("searching");
    // Inès a skill bar mais travaille à midi : moins de 11 h de repos -> exclue.
    expect(state.offers.map((o) => o.employee_id).sort()).toEqual(["eli", "sacha"]);
    expect(state.shifts.find((s) => s.id === "shift-5")).toMatchObject({ employee_id: null, status: "vacant" });
  });

  it("raises an alert when nobody is eligible", () => {
    for (const e of state.employees) if (e.id !== "jade") e.contact_consent_at = null;
    const { report } = jadeReportsAbsence();

    expect(findReplacement(state, report.id, now).report.status).toBe("unresolved");
    expect(state.events.some((e) => e.type === "no_replacement")).toBe(true);
  });

  it("does not send offers twice when the manager taps again", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    const again = findReplacement(state, report.id, now);

    expect(again.alreadyStarted).toBe(true);
    expect(state.offers).toHaveLength(2);
  });

  it("can start from a delay report too", () => {
    const { report } = reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "delay" }, now);

    expect(findReplacement(state, report.id, now).report.status).toBe("searching");
  });
});

describe("respondToOffer (autopilot)", () => {
  it("assigns the first acceptance and closes the other offers", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    const outcome = respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: true }, now);

    expect(outcome.outcome).toBe("accepted");
    expect(state.shifts.find((s) => s.id === "shift-5")).toMatchObject({
      employee_id: "eli",
      status: "covered",
      replacement_for_employee_id: "jade",
    });
    expect(state.reports[0].status).toBe("resolved");
    expect(offerFor("sacha").status).toBe("closed");
  });

  it("ignores a second acceptance: only one winner", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: true }, now);

    const late = respondToOffer(state, { offerId: offerFor("sacha").id, employeeId: "sacha", accept: true }, now);

    expect(late).toEqual({ outcome: "ignored", reason: "closed" });
    expect(state.shifts.find((s) => s.id === "shift-5")?.employee_id).toBe("eli");
  });

  it("ignores a duplicate answer to the same offer", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    const input = { offerId: offerFor("eli").id, employeeId: "eli", accept: true };
    respondToOffer(state, input, now);

    expect(respondToOffer(state, input, now)).toEqual({ outcome: "ignored", reason: "accepted" });
  });

  it("refuses answers from someone who did not get the offer", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    expect(() => respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "sacha", accept: true }, now)).toThrow(
      /pas pour vous/,
    );
  });

  it("raises an alert when everyone declines", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: false }, now);
    expect(state.reports[0].status).toBe("searching");

    respondToOffer(state, { offerId: offerFor("sacha").id, employeeId: "sacha", accept: false }, now);

    expect(state.reports[0].status).toBe("unresolved");
    expect(state.events.some((e) => e.type === "no_replacement")).toBe(true);
  });

  it("closes the offer once the shift has started", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    const afterStart = new Date("2026-10-04T18:30:00.000Z");

    const outcome = respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: true }, afterStart);

    expect(outcome).toEqual({ outcome: "ignored", reason: "closed" });
    expect(state.shifts.find((s) => s.id === "shift-5")?.status).toBe("vacant");
  });
});

describe("manager approval mode", () => {
  beforeEach(() => {
    updateSettings(state, { manager_approval_required: true });
  });

  it("holds the acceptance until the manager approves", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    const outcome = respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: true }, now);

    expect(outcome.outcome).toBe("pending_approval");
    expect(state.shifts.find((s) => s.id === "shift-5")?.status).toBe("vacant");

    approveReplacement(state, report.id, now);

    expect(state.shifts.find((s) => s.id === "shift-5")).toMatchObject({ employee_id: "eli", status: "covered" });
    expect(state.reports[0].status).toBe("resolved");
  });

  it("goes back to searching when the manager rejects the replacement", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);
    respondToOffer(state, { offerId: offerFor("eli").id, employeeId: "eli", accept: true }, now);

    rejectReplacement(state, report.id, now);

    expect(state.reports[0].status).toBe("searching");
    expect(offerFor("eli").status).toBe("rejected");
    expect(offerFor("sacha").status).toBe("pending");
  });

  it("refuses to approve when nothing is waiting", () => {
    const { report } = jadeReportsAbsence();

    expect(() => approveReplacement(state, report.id, now)).toThrow(DomainError);
  });
});

describe("lists", () => {
  it("shows pending offers to the replacement in the open-shift card format", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    const [card] = listOffersForEmployee(state, "eli", now);

    expect(card).toMatchObject({ role: "Bar", restaurant: "Chez Odile", start: "18:00", end: "23:00", hourly_rate: 16, urgent: false });
    expect(listOffersForEmployee(state, "tom", now)).toEqual([]);
  });

  it("marks an offer urgent when the shift starts within 24 h", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    const [card] = listOffersForEmployee(state, "eli", new Date("2026-10-04T10:00:00.000Z"));

    expect(card.urgent).toBe(true);
  });

  it("lists upcoming shifts with what was already reported", () => {
    jadeReportsAbsence();

    const shifts = listShiftsForEmployee(state, "jade", now);

    expect(shifts.map((s) => s.id)).toEqual(["shift-5", "shift-7"]);
    expect(shifts[0].reported).toEqual(["absence"]);
  });

  it("gives the manager a summary per report", () => {
    const { report } = jadeReportsAbsence();
    findReplacement(state, report.id, now);

    expect(listReports(state)[0]).toMatchObject({ kind: "absence", status: "searching", employee_name: "Jade", offers_sent: 2 });
  });
});
