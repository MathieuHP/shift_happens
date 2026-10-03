import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDemoState } from "@/lib/demo/demoState";
import { advanceExpiredCalls, findReplacement, reportShift } from "@/lib/inapp/service";
import { startDemoIncident } from "@/lib/inapp/simulate";
import { getAppState, resetAppState } from "@/lib/inapp/state";
import { dispatchPendingCalls } from "@/lib/voice/dispatchCalls";
import { providerEventDependencies, voiceRespondDependencies } from "@/lib/voice/inMemory";
import { ElevenLabsVoiceProvider, type CallLiveStatus, type PlaceCallRequest, type VoiceProvider } from "@/lib/voice/provider";
import { syncCallStatuses } from "@/lib/voice/syncCallStatus";
import { handleElevenLabsCallEvent } from "@/lib/voice/providerEvents";
import { handleVoiceRespond } from "@/lib/voice/respondToOffer";

// Samedi 3 octobre 2026, 19:00 à Bruxelles
const now = new Date("2026-10-03T17:00:00.000Z");
const after = (seconds: number) => new Date(now.getTime() + seconds * 1000);

// Faux fournisseur : enregistre les appels demandés, aucun appel réel.
function fakeProvider(options: { failFor?: string[] } = {}) {
  const requests: PlaceCallRequest[] = [];
  const live = { status: "ringing" as CallLiveStatus, reads: 0, throws: false }; // état de l'appel côté fournisseur (modifiable par les tests)
  const provider: VoiceProvider = {
    async getCallStatus() {
      live.reads += 1;
      if (live.throws) throw new Error("fournisseur injoignable");
      return live.status;
    },
    async placeCall(request) {
      requests.push(request);
      if (options.failFor?.some((number) => request.toNumber === number)) throw new Error("numéro refusé par le fournisseur");
      return { mode: "live", conversationId: `conv-${requests.length}`, callSid: `CA${requests.length}` };
    },
  };
  return { provider, requests, live };
}

const state = () => getAppState(now);
const dispatch = (provider: VoiceProvider, at: Date = now) => dispatchPendingCalls(state(), { getProvider: () => provider, now: at });
const phone = (id: string) => state().employees.find((e) => e.id === id)!.phone;
const roster = (at: Date = now) => Object.fromEntries(buildDemoState(state(), at).roster.map((r) => [r.id, r.status]));
const timeline = (at: Date = now) => buildDemoState(state(), at).timeline.map((e) => `${e.type}: ${e.message}`);

beforeEach(() => {
  resetAppState(now);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("voice calls on the in-memory state", () => {
  it("calls Kash first with the shift details, and remembers the conversation", async () => {
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();

    await dispatch(provider);

    expect(requests).toHaveLength(1);
    expect(requests[0].toNumber).toBe(phone("kash"));
    expect(requests[0].idempotencyKey).toBe(`offer:${state().offers[0].id}`);
    expect(requests[0].dynamicVariables).toMatchObject({
      restaurant_name: "Coli Brasserie",
      employee_first_name: "Kash",
      role: "Bar",
      shift_start: "19:05",
      shift_end: "00:00",
      hourly_rate: "16,00",
      total_amount: "78,67",
    });
    expect(state().calls[0]).toMatchObject({ status: "calling", conversation_id: "conv-1", call_sid: "CA1", provider: "elevenlabs" });
    expect(timeline()).toContain("call_placed: [LIVE] Appel lancé vers Kash.");
  });

  it("never dials two people at once: Mathieu waits for Kash's turn to end", async () => {
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();

    await dispatch(provider);
    await dispatch(provider);

    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash")]);
    expect(roster()).toMatchObject({ kash: "called", mathieu: "queued" });
  });

  it("two simultaneous dispatches place the call only once", async () => {
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();

    await Promise.all([dispatch(provider), dispatch(provider)]);

    expect(requests).toHaveLength(1);
  });

  it("after 30 s without answer, Mathieu is called and Kash's turn is over", async () => {
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();
    await dispatch(provider);

    const later = after(30);
    expect(advanceExpiredCalls(state(), later)).toBe(1);
    await dispatch(provider, later);

    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash"), phone("mathieu")]);
    expect(state().calls.map((c) => c.status)).toEqual(["no_answer", "calling"]);
    expect(roster(later)).toMatchObject({ kash: "no_answer", mathieu: "called" });
  });

  it("sends every call to DEMO_PHONE_OVERRIDE when it is set", async () => {
    vi.stubEnv("DEMO_PHONE_OVERRIDE", "+32400000000");
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();

    await dispatch(provider);

    expect(requests[0].toNumber).toBe("+32400000000");
  });

  it("does not place any call for a manager-driven search while voice is off", () => {
    const s = state();
    const { report } = reportShift(s, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
    findReplacement(s, report.id, now);

    expect(s.calls).toEqual([]);
  });

  it("places calls for a manager-driven search once VOICE_ENABLED is true", () => {
    vi.stubEnv("VOICE_ENABLED", "true");
    const s = state();
    const { report } = reportShift(s, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
    findReplacement(s, report.id, now);

    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({ status: "queued", employee_id: "kash" });
    expect(s.reports[0].call_timeout_seconds).toBe(30);
  });
});

describe("failures and contact rules", () => {
  it("moves on to Mathieu at once when the provider cannot place Kash's call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider({ failFor: [phone("kash")] });

    await dispatch(provider);

    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash"), phone("mathieu")]);
    expect(state().calls.map((c) => c.status)).toEqual(["failed", "calling"]);
    expect(timeline()).toContain("call_failed: L'appel vers Kash a échoué : on passe au suivant.");
    expect(roster()).toMatchObject({ kash: "no_answer", mathieu: "called" });
  });

  it("alerts the manager when every call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    startDemoIncident("no_show", now);
    const { provider } = fakeProvider({ failFor: [phone("kash"), phone("mathieu")] });

    await dispatch(provider);

    expect(buildDemoState(state(), now).currentCase?.cascadeStatus).toBe("unresolved");
    expect(timeline().at(-1)).toBe("no_replacement: Personne n'a pu être joint : aucun remplaçant.");
  });

  it("skips someone who has not consented, without calling them", async () => {
    startDemoIncident("no_show", now);
    state().employees.find((e) => e.id === "kash")!.contact_consent_at = null;
    const { provider, requests } = fakeProvider();

    await dispatch(provider);

    expect(requests.map((r) => r.toNumber)).toEqual([phone("mathieu")]);
    expect(roster()).toMatchObject({ kash: "skipped", mathieu: "called" });
    expect(timeline()).toContain("call_skipped: Kash n'est pas appelé : pas de consentement pour être contacté.");
  });

  it("never calls outside the contact window, and alerts the manager", async () => {
    vi.stubEnv("CONTACT_WINDOW_START", "08:00");
    vi.stubEnv("CONTACT_WINDOW_END", "09:00"); // il est 19:00 à Bruxelles
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();

    await dispatch(provider);

    expect(requests).toEqual([]);
    expect(timeline()).toContain("call_skipped: Kash n'est pas appelé : hors de la plage horaire d'appel (08:00–09:00).");
    expect(buildDemoState(state(), now).currentCase?.cascadeStatus).toBe("unresolved");
  });
});

describe("agent tool: respond_to_offer (by conversation id)", () => {
  const secret = "s3cret";
  async function respond(answer: "yes" | "no", conversationId: string | null, at: Date = now, provided: string | null = secret) {
    return handleVoiceRespond(
      { expectedSecret: secret, providedSecret: provided, conversationId, answer },
      voiceRespondDependencies(state(), at),
    );
  }

  async function startWithKashCalled() {
    startDemoIncident("no_show", now);
    const fake = fakeProvider();
    await dispatch(fake.provider);
    return fake;
  }

  it("rejects a wrong secret and a missing or unknown conversation", async () => {
    await startWithKashCalled();

    expect(await respond("yes", "conv-1", now, "wrong")).toMatchObject({ status: 401 });
    expect(await respond("yes", null)).toMatchObject({ status: 400 });
    expect(await respond("yes", "conv-unknown")).toMatchObject({ status: 404 });
    expect(state().offers[0].status).toBe("pending");
  });

  it("yes: the shift goes to the person who was called, found from the conversation", async () => {
    await startWithKashCalled();

    const result = await respond("yes", "conv-1", after(12));

    expect(result).toEqual({ status: 200, body: { result: "accepted" } });
    expect(state().shifts.find((s) => s.id === "tonight-jade")).toMatchObject({ employee_id: "kash", status: "covered" });
    expect(buildDemoState(state(), after(12)).managerNotification).toBe("Jade n'a pas pointé. J'ai géré : Kash couvre son shift.");
  });

  it("no: the next candidate is called", async () => {
    const { provider, requests } = await startWithKashCalled();

    expect(await respond("no", "conv-1", after(8))).toEqual({ status: 200, body: { result: "declined" } });
    await dispatch(provider, after(8));

    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash"), phone("mathieu")]);
    expect(roster(after(8))).toMatchObject({ kash: "declined", mathieu: "called" });
  });

  it("an answer repeated by the agent changes nothing", async () => {
    await startWithKashCalled();
    await respond("yes", "conv-1", after(5));

    expect(await respond("yes", "conv-1", after(6))).toEqual({ status: 200, body: { result: "ignored" } });
    expect(await respond("no", "conv-1", after(7))).toEqual({ status: 200, body: { result: "ignored" } });
  });

  it("an answer after the 30 s are over is ignored (the turn went to Mathieu)", async () => {
    await startWithKashCalled();

    expect(await respond("yes", "conv-1", after(31))).toEqual({ status: 200, body: { result: "ignored" } });
    expect(state().shifts.find((s) => s.id === "tonight-jade")?.status).toBe("vacant");
  });
});

describe("ElevenLabs call-initiation-failure webhook", () => {
  it("busy or unreachable: Kash's turn ends at once and Mathieu is called", async () => {
    startDemoIncident("no_show", now);
    const { provider, requests } = fakeProvider();
    await dispatch(provider);

    const result = await handleElevenLabsCallEvent(
      { type: "call_initiation_failure", data: { conversation_id: "conv-1", failure_reason: "busy" } },
      providerEventDependencies(state(), after(3)),
    );
    await dispatch(provider, after(3));

    expect(result).toEqual({ handled: true, advanced: true });
    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash"), phone("mathieu")]);
    expect(timeline(after(3))).toContain("call_no_answer: Kash n'a pas répondu (occupé ou injoignable) : on passe au suivant.");
  });

  it("an unknown conversation or a replayed event does nothing", async () => {
    startDemoIncident("no_show", now);
    const { provider } = fakeProvider();
    await dispatch(provider);
    const event = { type: "call_initiation_failure" as const, data: { conversation_id: "conv-1", failure_reason: "failed" } };

    await handleElevenLabsCallEvent(event, providerEventDependencies(state(), after(2)));
    const replay = await handleElevenLabsCallEvent(event, providerEventDependencies(state(), after(2)));
    const unknown = await handleElevenLabsCallEvent(
      { type: "call_initiation_failure", data: { conversation_id: "nope" } },
      providerEventDependencies(state(), after(2)),
    );

    expect(replay).toEqual({ handled: true, advanced: false });
    expect(unknown).toEqual({ handled: false });
  });
});

describe("while the person is talking, the 30 s timeout does not fire", () => {
  async function kashCalled() {
    startDemoIncident("no_show", now);
    const fake = fakeProvider();
    await dispatch(fake.provider);
    return fake;
  }
  const kashCall = () => state().calls[0];

  it("ringing does not hold the turn: 30 s without pick-up still moves on", async () => {
    const { provider, live } = await kashCalled();
    live.status = "ringing";

    await syncCallStatuses(state(), provider, after(29));

    expect(kashCall().answered_at).toBeNull();
    expect(advanceExpiredCalls(state(), after(30))).toBe(1);
  });

  it("once Kash picks up, the turn is held for as long as he talks (well past 30 s)", async () => {
    const { provider, live } = await kashCalled();
    live.status = "in_progress";

    await syncCallStatuses(state(), provider, after(12));

    expect(kashCall().answered_at).toBe(after(12).toISOString());
    expect(timeline(after(12))).toContain("call_answered: Kash a décroché.");
    expect(advanceExpiredCalls(state(), after(30))).toBe(0);
    expect(advanceExpiredCalls(state(), after(120))).toBe(0);
    expect(roster(after(120))).toMatchObject({ kash: "called", mathieu: "queued" });
  });

  it("his answer still counts while he talks, even after 30 s", async () => {
    const { provider, live } = await kashCalled();
    live.status = "in_progress";
    await syncCallStatuses(state(), provider, after(12));

    const result = await handleVoiceRespond(
      { expectedSecret: "s", providedSecret: "s", conversationId: "conv-1", answer: "yes" },
      voiceRespondDependencies(state(), after(75)),
    );

    expect(result).toEqual({ status: 200, body: { result: "accepted" } });
  });

  it("if the conversation ends without an answer, the turn ends and Mathieu is called", async () => {
    const { provider, requests, live } = await kashCalled();
    live.status = "in_progress";
    await syncCallStatuses(state(), provider, after(12));
    live.status = "ended";

    await syncCallStatuses(state(), provider, after(50));
    await dispatch(provider, after(50));

    expect(timeline(after(50))).toContain("call_no_answer: Kash n'a pas répondu (la conversation s'est terminée sans réponse) : on passe au suivant.");
    expect(requests.map((r) => r.toNumber)).toEqual([phone("kash"), phone("mathieu")]);
  });

  it("a conversation that never ends stops holding the turn after CALL_MAX_SECONDS", async () => {
    vi.stubEnv("CALL_MAX_SECONDS", "60");
    const { provider, live } = await kashCalled();
    live.status = "in_progress";
    await syncCallStatuses(state(), provider, after(10));

    expect(advanceExpiredCalls(state(), after(69))).toBe(0);
    expect(advanceExpiredCalls(state(), after(70))).toBe(1);
    expect(timeline(after(70))).toContain("call_no_answer: Kash : conversation trop longue (60 s) sans réponse : on passe au suivant.");
  });

  it("if the provider status cannot be read, the normal 30 s delay applies", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { provider, live } = await kashCalled();
    live.throws = true;

    await syncCallStatuses(state(), provider, after(10));

    expect(kashCall().answered_at).toBeNull();
    expect(advanceExpiredCalls(state(), after(30))).toBe(1);
  });

  it("asks the provider at most once every 1.5 s", async () => {
    const { provider, live } = await kashCalled();
    live.status = "ringing";

    await syncCallStatuses(state(), provider, after(5));
    await syncCallStatuses(state(), provider, after(6));
    await syncCallStatuses(state(), provider, after(7));

    expect(live.reads).toBe(2);
  });

  it("simulated calls have no real status: only the delay applies", async () => {
    startDemoIncident("no_show", now);
    await dispatch({ async placeCall() { return { mode: "simulated", conversationId: "simulated-1", callSid: null }; } });
    const { provider, live } = fakeProvider();

    await syncCallStatuses(state(), provider, after(5));

    expect(live.reads).toBe(0);
    expect(advanceExpiredCalls(state(), after(30))).toBe(1);
  });
});

describe("ElevenLabs provider: call status", () => {
  const providerWith = (status: unknown, ok = true) =>
    new ElevenLabsVoiceProvider({
      apiKey: "k",
      agentId: "agent_x",
      agentPhoneNumberId: "phnum_x",
      fetchImpl: (async () => ({ ok, json: async () => ({ status }) })) as unknown as typeof fetch,
    });

  it("maps the documented conversation statuses", async () => {
    expect(await providerWith("initiated").getCallStatus("c")).toBe("ringing");
    expect(await providerWith("in-progress").getCallStatus("c")).toBe("in_progress");
    expect(await providerWith("processing").getCallStatus("c")).toBe("ended");
    expect(await providerWith("done").getCallStatus("c")).toBe("ended");
    expect(await providerWith("failed").getCallStatus("c")).toBe("failed");
  });

  it("answers unknown for an unexpected status or an HTTP error, never throws", async () => {
    expect(await providerWith("something-new").getCallStatus("c")).toBe("unknown");
    expect(await providerWith("done", false).getCallStatus("c")).toBe("unknown");
  });
});
