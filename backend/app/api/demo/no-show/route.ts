import { checkDemoSecret } from "@/lib/security";
import { setDemoStateFromCascade } from "@/lib/demo/demoState";
import { simulateDemoNoShow } from "@/lib/demo/simulateDemoNoShow";

export async function POST(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  const result = simulateDemoNoShow();
  setDemoStateFromCascade(result);

  return Response.json(result);
}
