import { requireEnv } from "@/lib/env";
import { getAppState } from "@/lib/inapp/state";
import { runVoiceDispatch } from "@/lib/voice/dispatchCalls";
import { providerEventDependencies } from "@/lib/voice/inMemory";
import {
  handleElevenLabsCallEvent,
  verifyElevenLabsSignature,
  type ProviderCallEvent,
} from "@/lib/voice/providerEvents";

// POST /api/voice/status : webhook ElevenLabs « échec d'initiation d'appel » (signature vérifiée).
// Occupé / injoignable / échec : on passe au candidat suivant sans attendre la fin du délai.
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
    const now = new Date();
    // Seul l'événement signé d'échec d'initiation est traité ; les transcriptions ne sont ni configurées ni conservées.
    const result = await handleElevenLabsCallEvent(event as ProviderCallEvent, providerEventDependencies(getAppState(now), now));
    if (result.handled) void runVoiceDispatch(now);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("ElevenLabs call status processing failed", error);
    return Response.json({ error: "status_processing_failed" }, { status: 500 });
  }
}
