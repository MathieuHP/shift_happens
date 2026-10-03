import { timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type VoiceOfferAnswer = "yes" | "no";
export type VoiceOfferOutcome = "accepted" | "pending_approval" | "declined" | "ignored";

export type VoiceRespondDependencies = {
  findAttemptByConversationId: (conversationId: string) => Promise<{
    id: string;
    absenceCaseId: string;
  } | null>;
  respondToOffer: (attemptId: string, answer: VoiceOfferAnswer) => Promise<VoiceOfferOutcome>;
  advanceCascade: (absenceCaseId: string) => Promise<unknown>;
};

export function secretsMatch(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function handleVoiceRespond(
  input: {
    expectedSecret: string;
    providedSecret: string | null;
    conversationId: string | null;
    answer: VoiceOfferAnswer;
  },
  dependencies: VoiceRespondDependencies,
) {
  if (!input.providedSecret || !secretsMatch(input.expectedSecret, input.providedSecret)) {
    return { status: 401, body: { error: "unauthorized" } } as const;
  }
  if (!input.conversationId) {
    return { status: 400, body: { error: "missing_conversation_id" } } as const;
  }

  const attempt = await dependencies.findAttemptByConversationId(input.conversationId);
  if (!attempt) return { status: 404, body: { error: "conversation_not_found" } } as const;

  const outcome = await dependencies.respondToOffer(attempt.id, input.answer);
  if (outcome === "declined") {
    try {
      await dependencies.advanceCascade(attempt.absenceCaseId);
    } catch (error) {
      console.error("Could not advance voice offer cascade after a refusal", error);
    }
  }

  return { status: 200, body: { result: outcome } } as const;
}

export async function respondToOffer(attemptId: string, answer: VoiceOfferAnswer): Promise<VoiceOfferOutcome> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("respond_to_voice_offer", {
    p_attempt_id: attemptId,
    p_answer: answer,
  });
  if (error) throw error;
  if (data !== "accepted" && data !== "pending_approval" && data !== "declined" && data !== "ignored") {
    throw new Error("Unexpected response from respond_to_voice_offer");
  }
  return data;
}
