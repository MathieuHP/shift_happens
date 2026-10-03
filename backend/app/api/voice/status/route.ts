import { callNextCandidate } from "@/lib/cascade/callNextCandidate";
import { requireEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  handleElevenLabsCallEvent,
  verifyElevenLabsSignature,
  type ProviderCallEvent,
} from "@/lib/voice/providerEvents";
import type { CallAttemptStatus } from "@/lib/types";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyElevenLabsSignature({
    rawBody,
    signature: request.headers.get("elevenlabs-signature"),
    secret: requireEnv("ELEVENLABS_WEBHOOK_SECRET"),
  })) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!event || typeof event !== "object" || !("type" in event) || !("data" in event)) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  try {
    const dependencies = {
      async findAttemptByConversationId(conversationId: string) {
        const supabase = createSupabaseServiceClient();
        const { data, error } = await supabase
          .from("call_attempts")
          .select("id, absence_case_id")
          .eq("voice_conversation_id", conversationId)
          .maybeSingle();
        if (error) throw error;
        return data ? { id: data.id as string, absenceCaseId: data.absence_case_id as string } : null;
      },
      async finishAttempt(attemptId: string, status: Extract<CallAttemptStatus, "no_answer" | "failed">) {
        const supabase = createSupabaseServiceClient();
        const { data, error } = await supabase
          .from("call_attempts")
          .update({ status })
          .eq("id", attemptId)
          .eq("status", "calling")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      advanceCascade: callNextCandidate,
    };
    // Only the signed call-initiation failure event is acted on. Post-call
    // transcription events are not configured or persisted by this endpoint.
    await handleElevenLabsCallEvent(event as ProviderCallEvent, dependencies);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("ElevenLabs call status processing failed", error);
    return Response.json({ error: "status_processing_failed" }, { status: 500 });
  }
}
