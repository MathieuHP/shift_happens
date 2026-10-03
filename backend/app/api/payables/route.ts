import { handle } from "@/lib/inapp/http";
import { syncPayables } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";
import { getAppState } from "@/lib/inapp/state";

// GET /api/payables -> les paiements de shifts pour le gérant (à valider, payés)
export async function GET() {
  return handle(() => {
    const state = syncPayables(getAppState(), filePayoutsStore, new Date());
    const items = [...state.payables].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const toValidate = items.filter((p) => p.status === "to_validate" || p.status === "processing");
    return {
      items: items.map((p) => ({ ...p, amount: p.amount_cents / 100, has_payout_account: p.employee_id in state.accounts })),
      to_validate_total: toValidate.reduce((sum, p) => sum + p.amount_cents, 0) / 100,
    };
  });
}
