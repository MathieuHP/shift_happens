import { checkDemoSecret } from "@/lib/security";
import { getDemoState } from "@/lib/demo/demoState";

export async function GET(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  return Response.json(getDemoState());
}
