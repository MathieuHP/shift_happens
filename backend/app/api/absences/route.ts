import { z } from "zod";

import { requireEntitlement } from "@/lib/billing/guard";
import { handle, readJson } from "@/lib/inapp/http";
import { listReports, reportShift } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

const bodySchema = z.object({
  employee_id: z.string().min(1),
  shift_id: z.string().min(1),
  kind: z.enum(["absence", "delay"]),
  eta: z.string().regex(/^\d{2}:\d{2}$/, "eta doit être au format HH:MM").nullish(),
});

// POST /api/absences -> l'employé signale une absence ou un retard
export async function POST(request: Request) {
  const denied = requireEntitlement();
  if (denied) return denied;

  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    const { report, created } = reportShift(
      getAppState(),
      { employeeId: body.employee_id, shiftId: body.shift_id, kind: body.kind, eta: body.eta },
      new Date(),
    );
    return { id: report.id, kind: report.kind, status: report.status, created };
  });
}

// GET /api/absences -> la liste pour le gérant
export async function GET() {
  return handle(() => ({ items: listReports(getAppState(), new Date()) }));
}
