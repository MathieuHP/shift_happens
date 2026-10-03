import { createHmac, timingSafeEqual } from "node:crypto";
import type { CallAttemptStatus } from "@/lib/types";

const SIGNATURE_TOLERANCE_SECONDS = 30 * 60;

export function verifyElevenLabsSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
  now?: Date;
}) {
  if (!input.signature || !input.secret) return false;
  const parts = input.signature.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signature = parts.find((part) => part.startsWith("v0="));
  if (!timestamp || !/^\d+$/.test(timestamp) || !signature) return false;

  const timestampSeconds = Number(timestamp);
  const currentSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(currentSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = `v0=${createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex")}`;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export type ProviderCallEvent = {
  type: "call_initiation_failure";
  data: { conversation_id?: unknown; failure_reason?: unknown };
};

export type ProviderEventDependencies = {
  findAttemptByConversationId: (conversationId: string) => Promise<{
    id: string;
    absenceCaseId: string;
  } | null>;
  finishAttempt: (attemptId: string, status: Extract<CallAttemptStatus, "no_answer" | "failed">) => Promise<boolean>;
  advanceCascade: (absenceCaseId: string) => Promise<unknown>;
};

export async function handleElevenLabsCallEvent(
  event: ProviderCallEvent,
  dependencies: ProviderEventDependencies,
) {
  if (event.type !== "call_initiation_failure") return { handled: false };
  const conversationId = event.data?.conversation_id;
  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return { handled: false };
  }

  const attempt = await dependencies.findAttemptByConversationId(conversationId);
  if (!attempt) return { handled: false };

  const status = event.data.failure_reason === "busy" || event.data.failure_reason === "no-answer"
    ? "no_answer"
    : "failed";
  const changed = await dependencies.finishAttempt(attempt.id, status);
  if (changed) await dependencies.advanceCascade(attempt.absenceCaseId);
  return { handled: true, advanced: changed };
}
