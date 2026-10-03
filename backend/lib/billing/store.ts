import { readStore, writeStore } from "@/lib/store/jsonStore";
import type { SubscriptionStatus } from "@/lib/types";

export const RESTAURANT_ID = "chez-odile";

export type BillingState = {
  restaurant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  last_event_id: string | null;
  processed_event_ids: string[]; // pour ignorer les événements Stripe rejoués
};

export type BillingStore = {
  load(): BillingState;
  save(state: BillingState): void;
};

const emptyState = (): BillingState => ({
  restaurant_id: RESTAURANT_ID,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "inactive",
  current_period_end: null,
  last_event_id: null,
  processed_event_ids: [],
});

export const fileBillingStore: BillingStore = {
  load: () => readStore("billing.json", emptyState),
  save: (state) => writeStore("billing.json", state),
};

export { emptyState as emptyBillingState };
