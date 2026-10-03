import { optionalEnv } from "@/lib/env";
import { handle } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { payPayable } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";
import { getStripe } from "@/lib/stripe/client";

// POST /api/payables/{id}/pay -> le gérant valide les heures et paie cette ligne (virement Stripe, mode test)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const payable = await payPayable({ stripe: getStripe(), store: filePayoutsStore }, id, {
      now: new Date(),
      app: getAppState(),
      allowEarly: optionalEnv("ALLOW_EARLY_PAYOUT") === "true",
    });
    return { id: payable.id, status: payable.status, stripe_transfer_id: payable.stripe_transfer_id };
  });
}
