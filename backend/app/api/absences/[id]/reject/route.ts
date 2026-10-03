import { handle } from "@/lib/inapp/http";
import { rejectReplacement } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

// POST /api/absences/{id}/reject -> Le gérant refuse le remplaçant proposé
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const report = rejectReplacement(getAppState(), id, new Date());
    return { id: report.id, status: report.status };
  });
}
