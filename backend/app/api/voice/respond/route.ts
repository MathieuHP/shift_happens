import { requireEnv } from "@/lib/env";
import { getAppState } from "@/lib/inapp/state";
import { runVoiceDispatch } from "@/lib/voice/dispatchCalls";
import { voiceRespondDependencies } from "@/lib/voice/inMemory";
import { handleVoiceRespond, type VoiceOfferAnswer } from "@/lib/voice/respondToOffer";

function isVoiceOfferAnswer(value: unknown): value is VoiceOfferAnswer {
  return value === "yes" || value === "no";
}

// POST /api/voice/respond : outil `respond_to_offer` de l'agent ElevenLabs.
// En-têtes : x-voice-secret (= VOICE_TOOL_SECRET) et x-conversation-id. Corps : { "answer": "yes" | "no" }.
// L'offre est retrouvée à partir du conversation_id mémorisé quand l'appel a été lancé.
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

  try {
    const now = new Date();
    const result = await handleVoiceRespond(
      {
        expectedSecret: requireEnv("VOICE_TOOL_SECRET"),
        providedSecret: request.headers.get("x-voice-secret"),
        conversationId: request.headers.get("x-conversation-id"),
        answer: (body as { answer: VoiceOfferAnswer }).answer,
      },
      voiceRespondDependencies(getAppState(now), now),
    );
    if (result.status === 200) void runVoiceDispatch(now); // après un refus, l'appel suivant part tout de suite
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Voice response tool failed", error);
    return Response.json({ error: "voice_response_failed" }, { status: 500 });
  }
}
