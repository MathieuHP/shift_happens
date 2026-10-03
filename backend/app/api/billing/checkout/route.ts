import { requireEnv } from "@/lib/env";
import { createCheckoutSession } from "@/lib/billing/service";
import { fileBillingStore } from "@/lib/billing/store";
import { handle } from "@/lib/inapp/http";
import { frontendUrl, getStripe } from "@/lib/stripe/client";

// POST /api/billing/checkout -> { url } : adresse de la page de paiement Stripe (mode test)
export async function POST() {
  return handle(() =>
    createCheckoutSession({
      stripe: getStripe(),
      store: fileBillingStore,
      priceId: requireEnv("STRIPE_PRICE_ID"),
      frontendUrl: frontendUrl(),
    }),
  );
}
