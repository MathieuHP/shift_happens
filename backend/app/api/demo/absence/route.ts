import { buildDemoState } from "@/lib/demo/demoState";
import { handle } from "@/lib/inapp/http";
import { startDemoIncident } from "@/lib/inapp/simulate";
import { getAppState } from "@/lib/inapp/state";
import { checkDemoSecret } from "@/lib/security";
import { runVoiceDispatch } from "@/lib/voice/dispatchCalls";

// POST /api/demo/absence -> Simule une absence signalée par SMS : Jade se déclare malade.
// La recherche de remplaçant démarre aussitôt (Kash, puis Mathieu). Un second clic pendant l'incident ne fait rien de plus.
export async function POST(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return handle(async () => {
    const now = new Date();
    const { started } = startDemoIncident("absence", now);
    await runVoiceDispatch(now); // lance l'appel du premier candidat (Kash) avant de répondre
    return { started, ...buildDemoState(getAppState(now), now) };
  });
}
