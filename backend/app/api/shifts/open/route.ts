import { z } from "zod";

import { handle } from "@/lib/inapp/http";
import { listOffersForEmployee } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

// GET /api/shifts/open?employee_id=mathieu -> les offres de remplacement reçues par cet employé
export async function GET(request: Request) {
  return handle(() => {
    const employeeId = z.string().min(1, "employee_id manquant").parse(new URL(request.url).searchParams.get("employee_id"));
    return listOffersForEmployee(getAppState(), employeeId, new Date());
  });
}
