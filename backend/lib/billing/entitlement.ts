import type { SubscriptionStatus } from "@/lib/types";

// Règle binaire (décision du journal) : seuls `trialing` et `active` donnent accès.
export function isEntitled(status: SubscriptionStatus) {
  return status === "trialing" || status === "active";
}

// Statuts Stripe -> statuts de l'app.
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
      return status;
    case "unpaid":
      return "past_due";
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive"; // incomplete, paused, inconnu
  }
}
