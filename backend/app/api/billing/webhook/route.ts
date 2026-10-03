import { handleStripeEvent } from "@/lib/billing/service";
import { fileBillingStore } from "@/lib/billing/store";
import { requireEnv } from "@/lib/env";
import { markTransferReversed } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";
import { getStripe } from "@/lib/stripe/client";

// POST /api/billing/webhook : événements envoyés par Stripe (abonnement, virements).
// En local : stripe listen --forward-to localhost:3000/api/billing/webhook
export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  // La signature se calcule sur le corps BRUT : on le lit en texte, sans le transformer.
  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "transfer.reversed") {
      markTransferReversed(filePayoutsStore, event.data.object.metadata?.payable_id);
      return Response.json({ received: true });
    }
    const result = await handleStripeEvent({ stripe, store: fileBillingStore }, event);
    return Response.json({ received: true, ...result });
  } catch (error) {
    console.error("Stripe webhook failed", event.id, error);
    return new Response("Webhook handler failed", { status: 500 }); // Stripe réessaiera
  }
}
