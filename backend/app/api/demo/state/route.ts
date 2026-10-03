import { getDemoState } from "@/lib/demo/demoState";

export async function GET() {
  return Response.json(getDemoState());
}
