import { buildDemoState } from "@/lib/demo/demoState";
import { handle } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { checkDemoSecret } from "@/lib/security";

// GET /api/demo/state -> ce que montre l'écran "Cascade" (équipe, planning de ce soir, timeline)
export async function GET(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return handle(() => {
    const now = new Date();
    return buildDemoState(getAppState(now), now);
  });
}
