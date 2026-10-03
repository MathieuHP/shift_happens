import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { isEntitled, mapStripeStatus } from "@/lib/billing/entitlement";
import { requireEntitlement } from "@/lib/billing/guard";
import { createCheckoutSession, getBillingStatus, handleStripeEvent } from "@/lib/billing/service";
import { emptyBillingState, type BillingState, type BillingStore } from "@/lib/billing/store";

function memoryStore(initial: Partial<BillingState> = {}): BillingStore & { state: BillingState } {
  const holder = { state: { ...emptyBillingState(), ...initial } };
  return {
    get state() {
      return holder.state;
    },
    load: () => structuredClone(holder.state),
    save: (state) => {
      holder.state = structuredClone(state);
    },
  };
}

// Faux client Stripe : seulement ce que le code utilise.
function fakeStripe(overrides: Record<string, unknown> = {}) {
  const subscription = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { restaurant_id: "chez-odile" },
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  };
  return {
    subscription,
    client: {
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.test/s1" }) } },
      subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) },
      billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://portal.stripe.test/p1" }) } },
      ...overrides,
    } as unknown as Stripe,
  };
}

const event = (id: string, type: string, object: unknown) => ({ id, type, data: { object } }) as unknown as Stripe.Event;

describe("entitlement", () => {
  it("grants access only to trialing and active", () => {
    expect(["trialing", "active"].every((s) => isEntitled(s as "active"))).toBe(true);
    expect(["inactive", "past_due", "canceled"].some((s) => isEntitled(s as "active"))).toBe(false);
  });

  it("maps Stripe statuses to app statuses", () => {
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("incomplete")).toBe("inactive");
    expect(mapStripeStatus("paused")).toBe("inactive");
  });
});

describe("createCheckoutSession", () => {
  it("creates a subscription session for the configured price only", async () => {
    const { client } = fakeStripe();
    const result = await createCheckoutSession({ stripe: client, store: memoryStore(), priceId: "price_50", frontendUrl: "http://front" });

    expect(result.url).toBe("https://checkout.stripe.test/s1");
    const params = vi.mocked(client.checkout.sessions.create).mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_50", quantity: 1 }],
      client_reference_id: "chez-odile",
      success_url: "http://front/gerant/paiements?checkout=success",
    });
    expect(params.integration_identifier).toMatch(/^shiftsaver-subscription-[a-z]{8}$/);
  });

  it("reuses the existing Stripe customer", async () => {
    const { client } = fakeStripe();
    await createCheckoutSession({ stripe: client, store: memoryStore({ stripe_customer_id: "cus_9" }), priceId: "p", frontendUrl: "http://f" });

    expect(vi.mocked(client.checkout.sessions.create).mock.calls[0][0]).toMatchObject({ customer: "cus_9" });
  });

  it("refuses when the subscription is already active", async () => {
    const { client } = fakeStripe();
    await expect(
      createCheckoutSession({ stripe: client, store: memoryStore({ subscription_status: "active" }), priceId: "p", frontendUrl: "http://f" }),
    ).rejects.toThrow(/déjà actif/);
  });
});

describe("handleStripeEvent", () => {
  it("does not grant access from the checkout redirect alone: only the webhook does", async () => {
    const store = memoryStore();
    expect(getBillingStatus(store).entitled).toBe(false);

    const { client } = fakeStripe();
    await handleStripeEvent({ stripe: client, store }, event("evt_1", "checkout.session.completed", {
      mode: "subscription",
      client_reference_id: "chez-odile",
      subscription: "sub_1",
    }));

    expect(getBillingStatus(store)).toMatchObject({ status: "active", entitled: true, has_customer: true });
    expect(store.state.stripe_subscription_id).toBe("sub_1");
    expect(store.state.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it("ignores a replayed event: one effect only", async () => {
    const store = memoryStore();
    const { client } = fakeStripe();
    const session = event("evt_1", "checkout.session.completed", { mode: "subscription", client_reference_id: "chez-odile", subscription: "sub_1" });

    await handleStripeEvent({ stripe: client, store }, session);
    const replay = await handleStripeEvent({ stripe: client, store }, session);

    expect(replay).toEqual({ handled: false, duplicate: true });
    expect(vi.mocked(client.subscriptions.retrieve)).toHaveBeenCalledTimes(1);
  });

  it("uses the authoritative subscription state, even if events arrive out of order", async () => {
    const store = memoryStore({ stripe_subscription_id: "sub_1" });
    const { client, subscription } = fakeStripe();
    subscription.status = "canceled"; // état réel chez Stripe

    // Un vieil événement "updated active" arrive en retard : on lit l'état réel (annulé).
    await handleStripeEvent({ stripe: client, store }, event("evt_old", "customer.subscription.updated", { ...subscription, status: "active" }));

    expect(store.state.subscription_status).toBe("canceled");
  });

  it("moves to past_due then back to active", async () => {
    const store = memoryStore({ stripe_subscription_id: "sub_1" });
    const { client, subscription } = fakeStripe();

    subscription.status = "past_due";
    await handleStripeEvent({ stripe: client, store }, event("evt_a", "customer.subscription.updated", subscription));
    expect(getBillingStatus(store).entitled).toBe(false);

    subscription.status = "active";
    await handleStripeEvent({ stripe: client, store }, event("evt_b", "customer.subscription.updated", subscription));
    expect(getBillingStatus(store).entitled).toBe(true);
  });

  it("ignores subscriptions that belong to another restaurant and unrelated events", async () => {
    const store = memoryStore();
    const { client, subscription } = fakeStripe();
    const foreign = { ...subscription, id: "sub_x", metadata: {} };

    expect(await handleStripeEvent({ stripe: client, store }, event("evt_f", "customer.subscription.created", foreign))).toMatchObject({ handled: false });
    expect(await handleStripeEvent({ stripe: client, store }, event("evt_g", "charge.succeeded", {}))).toMatchObject({ handled: false });
    expect(store.state.subscription_status).toBe("inactive");
  });

  it("lets Stripe retry when the authoritative lookup fails", async () => {
    const store = memoryStore();
    const { client } = fakeStripe({ subscriptions: { retrieve: vi.fn().mockRejectedValue(new Error("network")) } });

    await expect(
      handleStripeEvent({ stripe: client, store }, event("evt_e", "checkout.session.completed", { mode: "subscription", client_reference_id: "chez-odile", subscription: "sub_1" })),
    ).rejects.toThrow("network");
    expect(store.state.processed_event_ids).toEqual([]); // pas marqué comme traité : Stripe réessaiera
  });
});

describe("requireEntitlement (REQUIRE_SUBSCRIPTION)", () => {
  it("lets everything through when the switch is off", () => {
    vi.stubEnv("REQUIRE_SUBSCRIPTION", "");
    expect(requireEntitlement(memoryStore())).toBeNull();
    vi.unstubAllEnvs();
  });

  it("answers 402 when on and the subscription is inactive, and lets active ones through", async () => {
    vi.stubEnv("REQUIRE_SUBSCRIPTION", "true");
    const denied = requireEntitlement(memoryStore()) as Response;
    expect(denied.status).toBe(402);
    expect((await denied.json()).error.code).toBe("entitlement_inactive");
    expect(requireEntitlement(memoryStore({ subscription_status: "active" }))).toBeNull();
    expect(requireEntitlement(memoryStore({ subscription_status: "past_due" }))).not.toBeNull();
    vi.unstubAllEnvs();
  });
});
