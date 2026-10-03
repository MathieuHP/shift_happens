// Paiement des shifts avec Stripe Connect (MODE TEST pour le hackathon).
// Le restaurant est débité sur la plateforme ; ShiftSaver vire ensuite le montant au compte Stripe
// de l'extra ("separate charges and transfers"). Ce n'est PAS de la paie légale : voir docs/ROADMAP.md.
import type Stripe from "stripe";

import type { AppState } from "@/lib/inapp/types";
import { localDate } from "@/lib/inapp/time";
import { DomainError } from "@/lib/inapp/types";

import type { Payable, PayoutsState, PayoutsStore } from "./store";

type Deps = { stripe: Stripe; store: PayoutsStore };

const roleLabel = (role: string) => ({ salle: "Salle", cuisine: "Cuisine", bar: "Bar" })[role] ?? role;

// ---------- 1. Les paiements à valider : un par shift remplacé ----------

// Crée (une seule fois par shift) une ligne à payer pour chaque shift couvert par un remplaçant.
export function syncPayables(app: AppState, store: PayoutsStore, now: Date): PayoutsState {
  const state = store.load();
  let changed = false;

  for (const shift of app.shifts) {
    if (shift.status !== "covered" || !shift.employee_id) continue;
    if (state.payables.some((p) => p.shift_id === shift.id)) continue; // déjà créé

    const employee = app.employees.find((e) => e.id === shift.employee_id);
    const hours = (new Date(shift.ends_at).getTime() - new Date(shift.starts_at).getTime()) / 3_600_000;
    const hourlyRate = shift.hourly_rate ?? 0;

    state.payables.push({
      id: crypto.randomUUID(),
      shift_id: shift.id,
      employee_id: shift.employee_id,
      employee_name: employee?.name ?? shift.employee_id,
      label: `${roleLabel(shift.role)} · ${app.restaurant_name}`,
      date: localDate(shift.starts_at),
      hours,
      hourly_rate: hourlyRate,
      amount_cents: Math.round(hours * hourlyRate * 100),
      currency: "eur",
      status: "to_validate",
      stripe_transfer_id: null,
      error: null,
      created_at: now.toISOString(),
      paid_at: null,
    });
    changed = true;
  }

  if (changed) store.save(state);
  return state;
}

// ---------- 2. Le compte de paiement de l'extra (compte Stripe lié) ----------

// Un compte est "prêt" quand Stripe l'autorise à recevoir des virements.
async function accountIsReady(stripe: Stripe, accountId: string) {
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
}

export async function getPayoutAccountStatus(deps: Deps, employeeId: string) {
  const accountId = deps.store.load().accounts[employeeId];
  if (!accountId) return { status: "none" as const };
  return { status: (await accountIsReady(deps.stripe, accountId)) ? ("ready" as const) : ("pending" as const) };
}

// Crée le compte lié si besoin et renvoie le lien d'inscription hébergé par Stripe.
export async function createPayoutOnboarding(deps: Deps & { frontendUrl: string }, employee: { id: string; name: string; email: string }) {
  const state = deps.store.load();
  let accountId = state.accounts[employee.id];

  if (!accountId) {
    const account = await deps.stripe.v2.core.accounts.create({
      display_name: employee.name,
      contact_email: employee.email, // Stripe l'exige pour un compte qui reçoit des virements
      identity: { country: "be", entity_type: "individual" },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      dashboard: "express",
      metadata: { employee_id: employee.id },
    });
    accountId = account.id;
    state.accounts[employee.id] = accountId;
    deps.store.save(state);
  }

  let link;
  try {
    link = await deps.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${deps.frontendUrl}/extra/gains?onboarding=refresh`,
          return_url: `${deps.frontendUrl}/extra/gains?onboarding=done`,
        },
      },
    });
  } catch (error) {
    // Stripe refuse ces liens dans le "mode test" partagé : il faut un sandbox (voir docs/stripe-setup.md).
    if (error instanceof Error && /sandbox/i.test(error.message)) {
      throw new DomainError(
        "sandbox_required",
        "Stripe n'autorise pas l'inscription des comptes de paiement dans le mode test partagé : utilisez les clés d'un sandbox Stripe (docs/stripe-setup.md).",
        501,
      );
    }
    throw error;
  }
  return { url: link.url };
}

// ---------- 3. Le gérant valide et paie ----------

export type PayOptions = { now: Date; app: AppState; allowEarly: boolean };

export async function payPayable(deps: Deps, payableId: string, options: PayOptions): Promise<Payable> {
  const state = deps.store.load();
  const payable = state.payables.find((p) => p.id === payableId);
  if (!payable) throw new DomainError("payable_not_found", "Paiement introuvable.", 404);

  if (payable.status === "paid") return payable; // déjà payé : on ne repaie pas
  if (payable.status !== "to_validate") {
    throw new DomainError("not_payable", "Ce paiement ne peut pas être validé.", 409);
  }

  const shift = options.app.shifts.find((s) => s.id === payable.shift_id);
  if (!options.allowEarly && shift && new Date(shift.ends_at) > options.now) {
    throw new DomainError("shift_not_finished", "Le shift n'est pas terminé : les heures ne peuvent pas être validées.", 409);
  }

  const accountId = state.accounts[payable.employee_id];
  if (!accountId) {
    throw new DomainError("payout_account_missing", `${payable.employee_name} n'a pas encore configuré son compte de paiement.`, 409);
  }
  if (!(await accountIsReady(deps.stripe, accountId))) {
    throw new DomainError("payout_account_not_ready", `Le compte de paiement de ${payable.employee_name} n'est pas encore validé par Stripe.`, 409);
  }

  // On verrouille la ligne avant d'appeler Stripe, pour qu'un double clic n'envoie pas deux virements.
  payable.status = "processing";
  payable.error = null;
  deps.store.save(state);

  try {
    const transfer = await deps.stripe.transfers.create(
      {
        amount: payable.amount_cents,
        currency: payable.currency,
        destination: accountId,
        transfer_group: `shift-${payable.shift_id}`,
        description: `${payable.label} · ${payable.date}`,
        metadata: { payable_id: payable.id, shift_id: payable.shift_id, employee_id: payable.employee_id },
      },
      { idempotencyKey: `payable-${payable.id}` }, // même clé = Stripe ne crée jamais deux virements
    );
    payable.status = "paid";
    payable.stripe_transfer_id = transfer.id;
    payable.paid_at = options.now.toISOString();
    deps.store.save(state);
    return payable;
  } catch (error) {
    payable.status = "to_validate";
    payable.error = error instanceof Error ? error.message : "Erreur Stripe";
    deps.store.save(state);
    throw new DomainError("transfer_failed", payable.error, 502);
  }
}

// Paie toutes les lignes en attente. Une ligne en échec n'empêche pas les autres.
export async function payAll(deps: Deps, options: PayOptions) {
  const pending = deps.store.load().payables.filter((p) => p.status === "to_validate");
  const results: Array<{ id: string; employee_name: string; ok: boolean; error?: string }> = [];

  for (const payable of pending) {
    try {
      await payPayable(deps, payable.id, options);
      results.push({ id: payable.id, employee_name: payable.employee_name, ok: true });
    } catch (error) {
      results.push({
        id: payable.id,
        employee_name: payable.employee_name,
        ok: false,
        error: error instanceof Error ? error.message : "Erreur",
      });
    }
  }
  return results;
}

// ---------- 4. Un virement est annulé chez Stripe (webhook transfer.reversed) ----------

export function markTransferReversed(store: PayoutsStore, payableId: string | undefined) {
  if (!payableId) return false;
  const state = store.load();
  const payable = state.payables.find((p) => p.id === payableId);
  if (!payable || payable.status === "reversed") return false;
  payable.status = "reversed";
  store.save(state);
  return true;
}
