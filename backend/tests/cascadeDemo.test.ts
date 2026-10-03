import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDemoState } from "@/lib/demo/demoState";
import { advanceExpiredCalls, findReplacement, reportShift, respondToOffer } from "@/lib/inapp/service";
import { startDemoIncident } from "@/lib/inapp/simulate";
import { getAppState, resetAppState } from "@/lib/inapp/state";

// Samedi 3 octobre 2026, 19:00 à Bruxelles
const now = new Date("2026-10-03T17:00:00.000Z");

beforeEach(() => {
  resetAppState(now);
});

const roster = () => Object.fromEntries(buildDemoState(getAppState(now), now).roster.map((r) => [r.id, r.status]));
const offerOf = (employeeId: string) => getAppState(now).offers.find((o) => o.employee_id === employeeId)!;
const answer = (employeeId: string, accept: boolean) =>
  respondToOffer(getAppState(now), { offerId: offerOf(employeeId).id, employeeId, accept }, now);

describe("cascade demo: everyone is on shift tonight, only Kash and Mathieu are free", () => {
  it("before anything happens: the whole team is scheduled, only the two extras are available", () => {
    expect(roster()).toEqual({
      ines: "scheduled",
      tom: "scheduled",
      lucie: "scheduled",
      mehdi: "scheduled",
      jade: "scheduled",
      kash: "available",
      mathieu: "available",
    });
    expect(buildDemoState(getAppState(now), now).status).toBe("idle");
  });

  it("a no-show starts the search at once: Kash is called first, Mathieu waits in the queue", () => {
    const { started } = startDemoIncident("no_show", now);
    const view = buildDemoState(getAppState(now), now);

    expect(started).toBe(true);
    expect(roster()).toMatchObject({ jade: "absent", kash: "called", mathieu: "queued", ines: "scheduled", tom: "scheduled" });
    expect(getAppState(now).offers.map((o) => o.employee_id)).toEqual(["kash", "mathieu"]);
    expect(view.currentCase).toMatchObject({ trigger: "no_show", absentEmployee: "Jade", shiftRole: "Bar", candidateCount: 2 });
    expect(view.managerNotification).toBe("Jade n'a pas pointé. J'appelle Kash…");
    expect(view.schedule.find((s) => s.id === "tonight-jade")?.status).toBe("vacant");
  });

  it("nobody else is ever offered the shift: the fixed team is already working", () => {
    startDemoIncident("no_show", now);

    expect(getAppState(now).offers.map((o) => o.employee_id).sort()).toEqual(["kash", "mathieu"]);
  });

  it("the shift starts in 5 minutes for Jade; the others have been working for 90 minutes", () => {
    startDemoIncident("no_show", now);
    const shifts = getAppState(now).shifts;
    const minutesFromNow = (iso: string) => (new Date(iso).getTime() - now.getTime()) / 60_000;

    expect(minutesFromNow(shifts.find((s) => s.id === "tonight-jade")!.starts_at)).toBe(5);
    expect(minutesFromNow(shifts.find((s) => s.id === "tonight-tom")!.starts_at)).toBe(-90);
  });

  it("a second click during the incident changes nothing", () => {
    const first = startDemoIncident("no_show", now);
    const second = startDemoIncident("no_show", now);

    expect(second.started).toBe(false);
    expect(second.report.id).toBe(first.report.id);
    expect(getAppState(now).offers).toHaveLength(2);
  });

  it("Kash declines: Mathieu is called next, then accepts and covers the shift", () => {
    startDemoIncident("no_show", now);

    answer("kash", false);
    expect(roster()).toMatchObject({ kash: "declined", mathieu: "called" });
    expect(buildDemoState(getAppState(now), now).managerNotification).toBe("Jade n'a pas pointé. J'appelle Mathieu…");

    answer("mathieu", true);
    const view = buildDemoState(getAppState(now), now);
    expect(roster()).toMatchObject({ mathieu: "accepted", kash: "declined" });
    expect(view.status).toBe("resolved");
    expect(view.managerNotification).toBe("Jade n'a pas pointé. J'ai géré : Mathieu couvre son shift.");
    expect(view.schedule.find((s) => s.id === "tonight-jade")).toMatchObject({ status: "covered", employeeName: "Mathieu", replacementFor: "Jade" });
  });

  it("if both decline, the manager is told to act", () => {
    startDemoIncident("no_show", now);
    answer("kash", false);
    answer("mathieu", false);

    const view = buildDemoState(getAppState(now), now);
    expect(view.status).toBe("resolved");
    expect(view.managerNotification).toContain("personne ne peut le remplacer");
    expect(view.currentCase?.cascadeStatus).toBe("unresolved");
  });

  it("once finished, a new click starts a fresh demo", () => {
    const first = startDemoIncident("no_show", now);
    answer("kash", true);

    const again = startDemoIncident("no_show", now);

    expect(again.started).toBe(true);
    expect(again.report.id).not.toBe(first.report.id);
    expect(roster()).toMatchObject({ kash: "called", mathieu: "queued" });
  });

  it("the sick-SMS trigger runs the same cascade, labeled as such", () => {
    startDemoIncident("absence", now);

    expect(buildDemoState(getAppState(now), now).currentCase?.trigger).toBe("sick_sms");
    expect(getAppState(now).offers.map((o) => o.employee_id)).toEqual(["kash", "mathieu"]);
  });

  it("the timeline tells the story in order, including each call to a replacement", () => {
    startDemoIncident("no_show", now);
    answer("kash", false);
    answer("mathieu", true);

    const timeline = buildDemoState(getAppState(now), now).timeline;

    expect(timeline.map((e) => e.type)).toEqual([
      "no_show_detected",
      "search_started",
      "call_started", // Appel de Kash
      "offer_declined",
      "call_started", // Appel de Mathieu
      "replacement_accepted",
      "case_resolved",
    ]);
    expect(timeline.filter((e) => e.type === "call_started").map((e) => e.message)).toEqual(["Appel de Kash…", "Appel de Mathieu…"]);
  });

  it("every timeline line has an exact timestamp, in restaurant time", () => {
    startDemoIncident("no_show", now);
    const later = new Date("2026-10-03T17:00:20.000Z"); // 19:00:20 à Bruxelles : Kash refuse avant la fin de son délai
    respondToOffer(getAppState(now), { offerId: offerOf("kash").id, employeeId: "kash", accept: false }, later);

    const timeline = buildDemoState(getAppState(later), later).timeline;

    expect(timeline[0]).toMatchObject({ type: "no_show_detected", at: "2026-10-03T17:00:00.000Z", time: "19:00:00" });
    expect(timeline.at(-1)).toMatchObject({ type: "call_started", message: "Appel de Mathieu…", time: "19:00:20" });
    expect(timeline.every((e) => /^\d{2}:\d{2}:\d{2}$/.test(e.time) && !Number.isNaN(Date.parse(e.at)))).toBe(true);
  });
});

describe("call timeout: no answer after 30 s, move on to the next candidate", () => {
  const after = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  const viewAt = (t: Date) => buildDemoState(getAppState(now), t);
  const statusAt = (t: Date) => Object.fromEntries(viewAt(t).roster.map((r) => [r.id, r.status]));

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Kash keeps his turn until 30 s are over, with a countdown deadline", () => {
    startDemoIncident("no_show", now);

    expect(statusAt(after(29))).toMatchObject({ kash: "called", mathieu: "queued" });
    expect(viewAt(after(29)).roster.find((r) => r.id === "kash")?.callExpiresAt).toBe(after(30).toISOString());
  });

  it("after 30 s without answer, Kash is skipped and Mathieu is called", () => {
    startDemoIncident("no_show", now);

    expect(statusAt(after(30))).toMatchObject({ kash: "no_answer", mathieu: "called" });
    const timeline = viewAt(after(30)).timeline;
    expect(timeline.slice(-2).map((e) => e.message)).toEqual(["Kash n'a pas répondu (30 s) : on passe au suivant.", "Appel de Mathieu…"]);
    expect(timeline.slice(-2).every((e) => e.at === after(30).toISOString())).toBe(true);
    expect(viewAt(after(30)).managerNotification).toBe("Jade n'a pas pointé. J'appelle Mathieu…");
  });

  it("Mathieu then gets his own 30 s; if he does not answer either, the manager is alerted", () => {
    startDemoIncident("no_show", now);

    expect(statusAt(after(59))).toMatchObject({ kash: "no_answer", mathieu: "called" });
    const view = viewAt(after(60));
    expect(statusAt(after(60))).toMatchObject({ kash: "no_answer", mathieu: "no_answer" });
    expect(view.currentCase?.cascadeStatus).toBe("unresolved");
    expect(view.managerNotification).toContain("personne ne peut le remplacer");
    expect(view.timeline.at(-1)).toMatchObject({ type: "no_replacement", message: "Personne n'a répondu : aucun remplaçant." });
  });

  it("catches up on several elapsed timeouts at once, with the real times in the timeline", () => {
    startDemoIncident("no_show", now);

    const timeline = viewAt(after(95)).timeline; // personne n'a regardé pendant 95 s

    expect(timeline.map((e) => `${e.type}@${e.time}`)).toEqual([
      "no_show_detected@19:00:00",
      "search_started@19:00:00",
      "call_started@19:00:00", // Appel de Kash
      "call_no_answer@19:00:30", // Kash sans réponse
      "call_started@19:00:30", // Appel de Mathieu
      "call_no_answer@19:01:00", // Mathieu sans réponse
      "no_replacement@19:01:00",
    ]);
  });

  it("a late answer from Kash is refused once his turn is over, and Mathieu can still take the shift", () => {
    startDemoIncident("no_show", now);
    const kashOffer = offerOf("kash");

    const late = respondToOffer(getAppState(now), { offerId: kashOffer.id, employeeId: "kash", accept: true }, after(31));
    expect(late).toEqual({ outcome: "ignored", reason: "no_answer" });

    respondToOffer(getAppState(now), { offerId: offerOf("mathieu").id, employeeId: "mathieu", accept: true }, after(40));
    expect(statusAt(after(40))).toMatchObject({ kash: "no_answer", mathieu: "accepted" });
    expect(viewAt(after(40)).managerNotification).toBe("Jade n'a pas pointé. J'ai géré : Mathieu couvre son shift.");
  });

  it("an answer before the deadline still wins (no timeout once someone accepts)", () => {
    startDemoIncident("no_show", now);
    respondToOffer(getAppState(now), { offerId: offerOf("kash").id, employeeId: "kash", accept: true }, after(29));

    expect(viewAt(after(300)).currentCase?.cascadeStatus).toBe("resolved");
    expect(statusAt(after(300))).toMatchObject({ kash: "accepted" });
  });

  it("the delay can be changed with CALL_TIMEOUT_SECONDS", () => {
    vi.stubEnv("CALL_TIMEOUT_SECONDS", "10");
    startDemoIncident("no_show", now);

    expect(statusAt(after(9))).toMatchObject({ kash: "called" });
    expect(statusAt(after(10))).toMatchObject({ kash: "no_answer", mathieu: "called" });
    expect(viewAt(after(10)).timeline.find((e) => e.type === "call_no_answer")?.message).toContain("(10 s)");
  });

  it("the manager-driven search has no timeout: offers stay open in the app", () => {
    const state = getAppState(now);
    const { report } = reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
    findReplacement(state, report.id, now);

    advanceExpiredCalls(state, after(3600));

    expect(state.offers.every((o) => o.status === "pending")).toBe(true);
    expect(state.reports[0].status).toBe("searching");
  });
});
