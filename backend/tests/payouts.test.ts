import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSeedState } from "@/lib/inapp/state";
import { findReplacement, reportShift, respondToOffer } from "@/lib/inapp/service";
import type { AppState } from "@/lib/inapp/types";
import {
  createPayoutOnboarding,
  getPayoutAccountStatus,
  markTransferReversed,
  payAll,
  payPayable,
  syncPayables,
} from "@/lib/payouts/service";
import type { PayoutsState, PayoutsStore } from "@/lib/payouts/store";

const now = new Date("2026-10-03T12:00:00.000Z");

function memoryStore(): PayoutsStore & { state: PayoutsState } {
  const holder = { state: { accounts: {}, payables: [] } as PayoutsState };
  return {
    get state() {
      return holder.state;
    },
    load: () => structuredClone(holder.state),
    save: (s) => {
      holder.state = structuredClone(s);
    },
  };
}

function fakeStripe(transfersCreate = vi.fn().mockResolvedValue({ id: "tr_1" }), transfersStatus = "active") {
  return {
    transfersCreate,
    client: {
      transfers: { create: transfersCreate },
      v2: {
        core: {
          accounts: {
            create: vi.fn().mockResolvedValue({ id: "acct_eli" }),
            retrieve: vi.fn().mockResolvedValue({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: transfersStatus } } } } } }),
          },
          accountLinks: { create: vi.fn().mockResolvedValue({ url: "https://connect.stripe.test/onboard" }) },
        },
      },
    } as unknown as Stripe,
  };
}

let app: AppState;
beforeEach(() => {
  app = createSeedState(now);
  // Jade absente, Eli la remplace (shift-5 : 18:00–23:00 à 16 €/h = 80 €)
  const { report } = reportShift(app, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
  findReplacement(app, report.id, now);
  const offer = app.offers.find((o) => o.employee_id === "eli")!;
  respondToOffer(app, { offerId: offer.id, employeeId: "eli", accept: true }, now);
});

describe("syncPayables", () => {
  it("creates one payable per covered shift, only once", () => {
    const store = memoryStore();
    syncPayables(app, store, now);
    syncPayables(app, store, now);

    expect(store.state.payables).toHaveLength(1);
    expect(store.state.payables[0]).toMatchObject({
      employee_id: "eli",
      hours: 5,
      hourly_rate: 16,
      amount_cents: 8000,
      currency: "eur",
      status: "to_validate",
      label: "Bar · Chez Odile",
    });
  });

  it("ignores shifts that are not covered by a replacement", () => {
    const store = memoryStore();
    const fresh = createSeedState(now);
    syncPayables(fresh, store, now);

    expect(store.state.payables).toEqual([]);
  });
});

describe("payout account", () => {
  it("is 'none' until onboarding starts, then 'pending' / 'ready' depending on Stripe", async () => {
    const store = memoryStore();
    expect(await getPayoutAccountStatus({ stripe: fakeStripe().client, store }, "eli")).toEqual({ status: "none" });

    await createPayoutOnboarding({ stripe: fakeStripe().client, store, frontendUrl: "http://front" }, { id: "eli", name: "Eli", email: "eli@example.com" });
    expect(await getPayoutAccountStatus({ stripe: fakeStripe(undefined, "restricted").client, store }, "eli")).toEqual({ status: "pending" });
    expect(await getPayoutAccountStatus({ stripe: fakeStripe().client, store }, "eli")).toEqual({ status: "ready" });
  });

  it("creates the connected account once and returns a hosted onboarding link", async () => {
    const store = memoryStore();
    const { client } = fakeStripe();
    const deps = { stripe: client, store, frontendUrl: "http://front" };

    const first = await createPayoutOnboarding(deps, { id: "eli", name: "Eli", email: "eli@example.com" });
    await createPayoutOnboarding(deps, { id: "eli", name: "Eli", email: "eli@example.com" });

    expect(first.url).toBe("https://connect.stripe.test/onboard");
    expect(vi.mocked(client.v2.core.accounts.create)).toHaveBeenCalledTimes(1);
    expect(store.state.accounts).toEqual({ eli: "acct_eli" });
    expect(vi.mocked(client.v2.core.accounts.create).mock.calls[0][0]).toMatchObject({
      identity: { country: "be", entity_type: "individual" },
      contact_email: "eli@example.com",
      dashboard: "express",
    });
  });
});

describe("onboarding in the shared test mode", () => {
  it("explains that a Stripe sandbox is required instead of a generic error, and keeps the account for a retry", async () => {
    const store = memoryStore();
    const { client } = fakeStripe();
    vi.mocked(client.v2.core.accountLinks.create).mockRejectedValue(new Error("Please switch to an account created in a sandbox to test."));

    await expect(
      createPayoutOnboarding({ stripe: client, store, frontendUrl: "http://front" }, { id: "eli", name: "Eli", email: "eli@example.com" }),
    ).rejects.toMatchObject({ code: "sandbox_required", status: 501 });
    expect(store.state.accounts).toEqual({ eli: "acct_eli" });
  });
});

describe("payPayable", () => {
  const options = () => ({ now, app, allowEarly: true });

  async function prepared() {
    const store = memoryStore();
    syncPayables(app, store, now);
    store.state.accounts = { eli: "acct_eli" };
    return { store, id: store.state.payables[0].id };
  }

  it("transfers the amount to the extra's connected account with an idempotency key", async () => {
    const { store, id } = await prepared();
    const { client, transfersCreate } = fakeStripe();

    const payable = await payPayable({ stripe: client, store }, id, options());

    expect(payable).toMatchObject({ status: "paid", stripe_transfer_id: "tr_1" });
    expect(transfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8000, currency: "eur", destination: "acct_eli", metadata: expect.objectContaining({ payable_id: id }) }),
      { idempotencyKey: `payable-${id}` },
    );
  });

  it("never pays twice: a second validation does not create another transfer", async () => {
    const { store, id } = await prepared();
    const { client, transfersCreate } = fakeStripe();

    await payPayable({ stripe: client, store }, id, options());
    await payPayable({ stripe: client, store }, id, options());

    expect(transfersCreate).toHaveBeenCalledTimes(1);
  });

  it("refuses when the extra has no payout account or Stripe has not validated it", async () => {
    const { store, id } = await prepared();
    store.state.accounts = {};
    await expect(payPayable({ stripe: fakeStripe().client, store }, id, options())).rejects.toThrow(/pas encore configuré/);

    store.state.accounts = { eli: "acct_eli" };
    await expect(payPayable({ stripe: fakeStripe(undefined, "restricted").client, store }, id, options())).rejects.toThrow(/pas encore validé/);
    expect(store.state.payables[0].status).toBe("to_validate");
  });

  it("refuses to validate hours before the shift has ended (unless demo mode allows it)", async () => {
    const { store, id } = await prepared();
    await expect(payPayable({ stripe: fakeStripe().client, store }, id, { now, app, allowEarly: false })).rejects.toThrow(/pas terminé/);

    const afterShift = new Date("2026-10-05T00:00:00.000Z");
    const ok = await payPayable({ stripe: fakeStripe().client, store }, id, { now: afterShift, app, allowEarly: false });
    expect(ok.status).toBe("paid");
  });

  it("keeps the payable payable and shows the Stripe error when the transfer fails", async () => {
    const { store, id } = await prepared();
    const { client } = fakeStripe(vi.fn().mockRejectedValue(new Error("Insufficient funds in your Stripe account")));

    await expect(payPayable({ stripe: client, store }, id, options())).rejects.toThrow(/Insufficient funds/);

    expect(store.state.payables[0]).toMatchObject({ status: "to_validate", error: "Insufficient funds in your Stripe account" });
  });

  it("payAll pays what it can and reports the failures", async () => {
    const { store } = await prepared();
    store.state.accounts = {}; // personne n'a de compte -> échec, sans bloquer le reste
    const results = await payAll({ stripe: fakeStripe().client, store }, options());

    expect(results).toEqual([expect.objectContaining({ ok: false, employee_name: "Eli" })]);
  });
});

describe("markTransferReversed", () => {
  it("marks the payable as reversed once", async () => {
    const store = memoryStore();
    syncPayables(app, store, now);
    const id = store.state.payables[0].id;

    expect(markTransferReversed(store, id)).toBe(true);
    expect(markTransferReversed(store, id)).toBe(false);
    expect(markTransferReversed(store, "unknown")).toBe(false);
    expect(store.state.payables[0].status).toBe("reversed");
  });
});
