import { getBillingStatus } from "@/lib/billing/service";
import { fileBillingStore } from "@/lib/billing/store";
import { handle } from "@/lib/inapp/http";

// GET /api/billing/status -> état de l'abonnement (mis à jour uniquement par les webhooks Stripe)
export async function GET() {
  return handle(() => getBillingStatus(fileBillingStore));
}
