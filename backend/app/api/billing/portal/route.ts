import { createPortalSession } from "@/lib/billing/service";
import { fileBillingStore } from "@/lib/billing/store";
import { handle } from "@/lib/inapp/http";
import { frontendUrl, getStripe } from "@/lib/stripe/client";

// POST /api/billing/portal -> { url } : portail client Stripe pour gérer ou annuler l'abonnement
export async function POST() {
  return handle(() => createPortalSession({ stripe: getStripe(), store: fileBillingStore, frontendUrl: frontendUrl() }));
}
