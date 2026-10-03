import { z } from "zod";

import { handle } from "@/lib/inapp/http";
import { listShiftsForEmployee } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";

// GET /api/my-shifts?employee_id=jade -> les prochains shifts d'un employé
export async function GET(request: Request) {
  return handle(() => {
    const employeeId = z.string().min(1, "employee_id manquant").parse(new URL(request.url).searchParams.get("employee_id"));
    return { shifts: listShiftsForEmployee(getAppState(), employeeId, new Date()) };
  });
}
