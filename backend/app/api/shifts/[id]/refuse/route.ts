import { z } from "zod";

import { handle, readJson } from "@/lib/inapp/http";
import { respondToOffer } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

const bodySchema = z.object({ employee_id: z.string().min(1) });

// POST /api/shifts/{offer_id}/refuse  corps : { "employee_id": "eli" }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    const result = respondToOffer(getAppState(), { offerId: id, employeeId: body.employee_id, accept: false }, new Date());
    return { id, ...result };
  });
}
