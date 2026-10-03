import { z } from "zod";

import { handle } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { syncPayables } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";

// GET /api/earnings?employee_id=eli -> gains de l'extra (virements reçus + shifts à venir)
export async function GET(request: Request) {
  return handle(() => {
    const employeeId = z.string().min(1, "employee_id manquant").parse(new URL(request.url).searchParams.get("employee_id"));
    const now = new Date();
    const mine = syncPayables(getAppState(), filePayoutsStore, now).payables.filter((p) => p.employee_id === employeeId);

    const paid = mine.filter((p) => p.status === "paid");
    const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    const lastPaid = [...paid].sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0];

    return {
      week_total: paid.filter((p) => new Date(p.paid_at ?? 0).getTime() >= weekAgo).reduce((s, p) => s + p.amount_cents, 0) / 100,
      last_payment: lastPaid ? { amount: lastPaid.amount_cents / 100, date: (lastPaid.paid_at ?? "").slice(0, 10) } : null,
      items: mine
        .filter((p) => p.status !== "reversed")
        .map((p) => ({
          id: p.id,
          type: "shift",
          label: p.label,
          date: p.date,
          amount: p.amount_cents / 100,
          status: p.status === "paid" ? "paid" : "upcoming",
        })),
    };
  });
}
