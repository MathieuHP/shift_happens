import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  handleElevenLabsCallEvent,
  verifyElevenLabsSignature,
  type ProviderEventDependencies,
} from "../lib/voice/providerEvents";

describe("ElevenLabs call events", () => {
  it("verifies a fresh signed raw request body", () => {
    const rawBody = JSON.stringify({ type: "call_initiation_failure" });
    const timestamp = String(Math.floor(new Date("2026-10-03T16:00:00Z").getTime() / 1000));
    const secret = "webhook-secret";
    const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    expect(verifyElevenLabsSignature({
      rawBody,
      signature: `t=${timestamp},v0=${digest}`,
      secret,
      now: new Date("2026-10-03T16:00:00Z"),
    })).toBe(true);
  });

  it("rejects an old signature", () => {
    expect(verifyElevenLabsSignature({
      rawBody: "{}",
      signature: "t=1,v0=invalid",
      secret: "secret",
      now: new Date("2026-10-03T16:00:00Z"),
    })).toBe(false);
  });

  it("advances once after a no-answer provider callback", async () => {
    const dependencies: ProviderEventDependencies = {
      findAttemptByConversationId: vi.fn(async () => ({ id: "attempt-1", absenceCaseId: "case-1" })),
      finishAttempt: vi.fn(async (_id, status) => status === "no_answer"),
      advanceCascade: vi.fn(async () => undefined),
    };
    await expect(handleElevenLabsCallEvent({
      type: "call_initiation_failure",
      data: { conversation_id: "conversation-1", failure_reason: "no-answer" },
    }, dependencies)).resolves.toEqual({ handled: true, advanced: true });
    expect(dependencies.advanceCascade).toHaveBeenCalledWith("case-1");
  });

  it("does not store or process transcript webhooks", async () => {
    const dependencies: ProviderEventDependencies = {
      findAttemptByConversationId: vi.fn(),
      finishAttempt: vi.fn(),
      advanceCascade: vi.fn(),
    };
    await expect(handleElevenLabsCallEvent({
      type: "post_call_transcription",
      data: { conversation_id: "conversation-1" },
    } as never, dependencies)).resolves.toEqual({ handled: false });
    expect(dependencies.findAttemptByConversationId).not.toHaveBeenCalled();
  });
});
