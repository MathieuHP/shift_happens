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
  const configuredUrl = optionalEnv("FRONTEND_URL");
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  // Vercel serves both services on this deployment hostname. The internal
  // service binding URL must never be sent to a customer's browser.
  const deploymentHost = optionalEnv("VERCEL_URL");
  if (deploymentHost) return `https://${deploymentHost}`;

  return "http://localhost:5173";
}
