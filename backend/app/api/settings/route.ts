import { z } from "zod";

import { handle, readJson } from "@/lib/inapp/http";
import { updateSettings } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

const bodySchema = z.object({ manager_approval_required: z.boolean().optional() });

// GET /api/settings -> réglages du restaurant
export async function GET() {
  return handle(() => getAppState().settings);
}

// PUT /api/settings  corps : { "manager_approval_required": true }
export async function PUT(request: Request) {
  return handle(async () => updateSettings(getAppState(), bodySchema.parse(await readJson(request))));
}
