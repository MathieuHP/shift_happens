import { buildDemoState } from "@/lib/demo/demoState";
import { handle } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { checkDemoSecret } from "@/lib/security";
import { runVoiceDispatch, syncVoiceCalls } from "@/lib/voice/dispatchCalls";

// GET /api/demo/state -> ce que montre l'écran "Cascade" (équipe, planning de ce soir, timeline)
export async function GET(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return handle(async () => {
    const now = new Date();
    await syncVoiceCalls(now); // qui a décroché ? (suspend le délai tant que la personne parle)
    const view = buildDemoState(getAppState(now), now);
    void runVoiceDispatch(now); // si un délai vient d'expirer, l'appel suivant part (sans retarder cette réponse)
    return view;
  });
}
