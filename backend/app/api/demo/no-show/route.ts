import { setDemoStateFromCascade } from "@/lib/demo/demoState";
import { simulateDemoNoShow } from "@/lib/demo/simulateDemoNoShow";

export async function POST() {
  const result = simulateDemoNoShow();
  setDemoStateFromCascade(result);

  return Response.json(result);
}
