import { handle } from "@/lib/inapp/http";
import { approveReplacement } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

// POST /api/absences/{id}/approve -> Le gérant confirme le remplaçant (si l'approbation est activée)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const report = approveReplacement(getAppState(), id, new Date());
    return { id: report.id, status: report.status };
  });
}
