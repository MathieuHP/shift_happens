import { describe, expect, it, vi } from "vitest";
import {
  handleVoiceRespond,
  type VoiceRespondDependencies,
} from "../lib/voice/respondToOffer";

function setup(outcome: "accepted" | "pending_approval" | "declined" | "ignored" = "accepted") {
  const dependencies: VoiceRespondDependencies = {
    findAttemptByConversationId: vi.fn(async (conversationId) =>
      conversationId === "known-conversation"
        ? { id: "attempt-1", absenceCaseId: "case-1" }
        : null,
    ),
    respondToOffer: vi.fn(async () => outcome),
    advanceCascade: vi.fn(async () => undefined),
  };
  return dependencies;
}

const baseInput = {
  expectedSecret: "shared-test-secret",
  providedSecret: "shared-test-secret",
  conversationId: "known-conversation",
  answer: "yes" as const,
};

describe("handleVoiceRespond", () => {
  it("rejects a bad secret before looking up the conversation", async () => {
    const dependencies = setup();
    await expect(handleVoiceRespond({ ...baseInput, providedSecret: "wrong" }, dependencies))
      .resolves.toMatchObject({ status: 401 });
    expect(dependencies.findAttemptByConversationId).not.toHaveBeenCalled();
  });

  it("rejects an unknown conversation", async () => {
    const dependencies = setup();
    await expect(handleVoiceRespond({ ...baseInput, conversationId: "unknown" }, dependencies))
      .resolves.toMatchObject({ status: 404 });
    expect(dependencies.respondToOffer).not.toHaveBeenCalled();
  });

  it("returns ignored for duplicate or closed offers", async () => {
    const dependencies = setup("ignored");
    await expect(handleVoiceRespond(baseInput, dependencies))
      .resolves.toEqual({ status: 200, body: { result: "ignored" } });
    expect(dependencies.advanceCascade).not.toHaveBeenCalled();
  });

  it("advances after a refusal", async () => {
    const dependencies = setup("declined");
    await expect(handleVoiceRespond({ ...baseInput, answer: "no" }, dependencies))
      .resolves.toEqual({ status: 200, body: { result: "declined" } });
    expect(dependencies.advanceCascade).toHaveBeenCalledWith("case-1");
  });

  it("returns pending approval when the manager must confirm", async () => {
    const dependencies = setup("pending_approval");
    await expect(handleVoiceRespond(baseInput, dependencies))
      .resolves.toEqual({ status: 200, body: { result: "pending_approval" } });
  });
});
