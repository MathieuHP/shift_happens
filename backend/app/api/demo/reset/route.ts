import { checkDemoSecret } from "@/lib/security";
import { handle } from "@/lib/inapp/http";
import { resetAppState } from "@/lib/inapp/state";

// POST /api/demo/reset -> remet les données de démo "Chez Odile" à zéro
export async function POST(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return handle(() => {
    resetAppState();
    return { ok: true };
  });
}
