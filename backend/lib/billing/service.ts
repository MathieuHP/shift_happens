import type Stripe from "stripe";

import { DomainError } from "@/lib/inapp/types";

import { isEntitled, mapStripeStatus } from "./entitlement";
import { RESTAURANT_ID, type BillingState, type BillingStore } from "./store";

const MAX_REMEMBERED_EVENTS = 200;

function randomLetters(count: number) {
  return Array.from({ length: count }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
}

// ---------- 1. Le gérant s'abonne : session Stripe Checkout ----------

export async function createCheckoutSession(deps: {
  stripe: Stripe;
  store: BillingStore;
  priceId: string;
  frontendUrl: string;
}) {
  const state = deps.store.load();
  if (isEntitled(state.subscription_status)) {
    throw new DomainError("already_subscribed", "L'abonnement est déjà actif.", 409);
  }

  const session = await deps.stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: deps.priceId, quantity: 1 }],
    client_reference_id: RESTAURANT_ID,
    metadata: { restaurant_id: RESTAURANT_ID },
    subscription_data: { metadata: { restaurant_id: RESTAURANT_ID } },
    success_url: `${deps.frontendUrl}/gerant/paiements?checkout=success`,
    cancel_url: `${deps.frontendUrl}/gerant/paiements?checkout=cancelled`,
    integration_identifier: `shiftsaver-subscription-${randomLetters(8)}`,
    ...(state.stripe_customer_id ? { customer: state.stripe_customer_id } : {}),
  });

  if (!session.url) throw new DomainError("checkout_failed", "Stripe n'a pas renvoyé d'adresse de paiement.", 502);
  return { url: session.url };
}

// ---------- 2. Portail client Stripe (gérer / annuler l'abonnement) ----------

export async function createPortalSession(deps: { stripe: Stripe; store: BillingStore; frontendUrl: string }) {
  const { stripe_customer_id } = deps.store.load();
  if (!stripe_customer_id) {
    throw new DomainError("no_customer", "Aucun abonnement à gérer pour le moment.", 409);
  }
  const session = await deps.stripe.billingPortal.sessions.create({
    customer: stripe_customer_id,
    return_url: `${deps.frontendUrl}/gerant/paiements`,
  });
  return { url: session.url };
}

// ---------- 3. Statut affiché au gérant ----------

export function getBillingStatus(store: BillingStore) {
  const state = store.load();
  return {
    status: state.subscription_status,
    entitled: isEntitled(state.subscription_status),
    current_period_end: state.current_period_end,
    has_customer: state.stripe_customer_id !== null,
  };
}

// ---------- 4. Événements Stripe (webhook) ----------

// Lit l'état réel de l'abonnement chez Stripe. C'est la source de vérité :
// ça évite les erreurs si deux événements arrivent dans le désordre.
async function reconcileSubscription(stripe: Stripe, state: BillingState, subscriptionId: string, fallback?: Stripe.Subscription) {
  let subscription = fallback;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (!fallback) throw error; // sans repli, on laisse Stripe réessayer plus tard
  }
  if (!subscription) return;

  state.stripe_subscription_id = subscription.id;
  state.stripe_customer_id =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  state.subscription_status = mapStripeStatus(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  state.current_period_end = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

function belongsToRestaurant(subscription: Stripe.Subscription, state: BillingState) {
  return subscription.metadata?.restaurant_id === RESTAURANT_ID || subscription.id === state.stripe_subscription_id;
}

export async function handleStripeEvent(deps: { stripe: Stripe; store: BillingStore }, event: Stripe.Event) {
  const state = deps.store.load();

  // Événement déjà traité : on ne fait rien (Stripe peut renvoyer le même événement).
  if (state.processed_event_ids.includes(event.id)) return { handled: false, duplicate: true };

  let handled = true;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const isOurs = session.mode === "subscription" && session.client_reference_id === RESTAURANT_ID;
      if (!isOurs || !session.subscription) {
        handled = false;
        break;
      }
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await reconcileSubscription(deps.stripe, state, subscriptionId);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      if (!belongsToRestaurant(subscription, state)) {
        handled = false;
        break;
      }
      await reconcileSubscription(deps.stripe, state, subscription.id, subscription);
      break;
    }
    default:
      handled = false;
  }

  state.last_event_id = event.id;
  state.processed_event_ids = [...state.processed_event_ids, event.id].slice(-MAX_REMEMBERED_EVENTS);
  deps.store.save(state);
  return { handled, duplicate: false };
}
