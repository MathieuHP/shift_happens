import Stripe from "stripe";

import { optionalEnv, requireEnv } from "@/lib/env";

export function hasStripeConfig() {
  return Boolean(optionalEnv("STRIPE_SECRET_KEY"));
}

// Client créé à la demande : pas d'erreur au build si la clé n'est pas encore configurée.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return client;
}

// Adresse du front, utilisée pour les retours de Checkout et d'onboarding.
export function frontendUrl() {
  return optionalEnv("FRONTEND_URL") ?? "http://localhost:5173";
}
