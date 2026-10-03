import { optionalEnv } from "@/lib/env";
import { handle } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { payAll, syncPayables } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";
import { getStripe } from "@/lib/stripe/client";

// POST /api/payables/pay-all -> "Valider et payer" : paie toutes les lignes en attente
export async function POST() {
  return handle(async () => {
    const now = new Date();
    const app = getAppState();
    syncPayables(app, filePayoutsStore, now);
    const results = await payAll({ stripe: getStripe(), store: filePayoutsStore }, {
      now,
      app,
      allowEarly: optionalEnv("ALLOW_EARLY_PAYOUT") === "true",
    });
    return { results, paid: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  });
}
