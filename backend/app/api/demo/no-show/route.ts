import { buildDemoState } from "@/lib/demo/demoState";
import { handle } from "@/lib/inapp/http";
import { startDemoIncident } from "@/lib/inapp/simulate";
import { getAppState } from "@/lib/inapp/state";
import { checkDemoSecret } from "@/lib/security";

// POST /api/demo/no-show -> Simule un no-show : Jade n'a pas pointé 5 minutes avant son shift.
// La recherche de remplaçant démarre aussitôt (Kash, puis Mathieu). Un second clic pendant l'incident ne fait rien de plus.
export async function POST(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return handle(() => {
    const now = new Date();
    const { started } = startDemoIncident("no_show", now);
    return { started, ...buildDemoState(getAppState(now), now) };
  });
}
