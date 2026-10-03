import { callNextCandidate } from "@/lib/cascade/callNextCandidate";
import { requireEnv } from "@/lib/env";
import {
  handleVoiceRespond,
  respondToOffer,
  type VoiceOfferAnswer,
} from "@/lib/voice/respondToOffer";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function isVoiceOfferAnswer(value: unknown): value is VoiceOfferAnswer {
  return value === "yes" || value === "no";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !isVoiceOfferAnswer((body as { answer?: unknown }).answer)) {
    return Response.json({ error: "invalid_answer" }, { status: 400 });
  }

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
    respondToOffer,
    advanceCascade: callNextCandidate,
  };

  try {
    const result = await handleVoiceRespond(
      {
        expectedSecret: requireEnv("VOICE_TOOL_SECRET"),
        providedSecret: request.headers.get("x-voice-secret"),
        conversationId: request.headers.get("x-conversation-id"),
        answer: (body as { answer: VoiceOfferAnswer }).answer,
      },
      dependencies,
    );
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Voice response tool failed", error);
    return Response.json({ error: "voice_response_failed" }, { status: 500 });
  }
}
