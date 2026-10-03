import { handle } from "@/lib/inapp/http";
import { findReplacement } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

// POST /api/absences/{id}/find-replacement -> Le gérant lance la recherche d'un remplaçant
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const result = findReplacement(getAppState(), id, new Date());
    return { id: id, status: result.report.status, offers_sent: result.offers.length, already_started: result.alreadyStarted };
  });
}
