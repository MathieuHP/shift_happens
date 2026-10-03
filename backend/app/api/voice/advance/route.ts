import { requireEnv } from "@/lib/env";
import { advanceExpiredCalls } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";
import { runVoiceDispatch, syncVoiceCalls } from "@/lib/voice/dispatchCalls";
import { secretsMatch } from "@/lib/voice/respondToOffer";

// POST /api/voice/advance : fait passer au candidat suivant les appels restés sans réponse (CALL_TIMEOUT_SECONDS).
// Protégé par x-voice-secret. Utile si personne ne lit l'état (l'écran Remplacements le fait déjà toutes les 3 s) :
// un planificateur peut l'appeler toutes les 15 à 30 secondes.
export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-voice-secret");
  if (!suppliedSecret || !secretsMatch(requireEnv("VOICE_TOOL_SECRET"), suppliedSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    await syncVoiceCalls(now); // qui a décroché ? ces appels ne sont pas interrompus par le délai
    const advancedCount = advanceExpiredCalls(getAppState(now), now);
    await runVoiceDispatch(now);
    return Response.json({ advancedCount });
  } catch (error) {
    console.error("Voice call timeout processing failed", error);
    return Response.json({ error: "timeout_processing_failed" }, { status: 500 });
  }
}
