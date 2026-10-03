import { readStore, writeStore } from "@/lib/store/jsonStore";

// to_validate : en attente de la validation du gérant
// processing  : virement en cours d'envoi à Stripe
// paid        : virement créé chez Stripe vers le compte de l'extra
// reversed    : virement annulé ensuite (webhook transfer.reversed)
export type PayableStatus = "to_validate" | "processing" | "paid" | "reversed";

export type Payable = {
  id: string;
  shift_id: string;
  employee_id: string;
  employee_name: string;
  label: string; // ex. "Bar · Chez Odile"
  date: string; // AAAA-MM-JJ
  hours: number;
  hourly_rate: number;
  amount_cents: number;
  currency: "eur";
  status: PayableStatus;
  stripe_transfer_id: string | null;
  error: string | null;
  created_at: string;
  paid_at: string | null;
};

export type PayoutsState = {
  accounts: Record<string, string>; // employee_id -> compte Stripe lié (acct_…)
  payables: Payable[];
};

export type PayoutsStore = {
  load(): PayoutsState;
  save(state: PayoutsState): void;
};

export const filePayoutsStore: PayoutsStore = {
  load: () => readStore<PayoutsState>("payouts.json", () => ({ accounts: {}, payables: [] })),
  save: (state) => writeStore("payouts.json", state),
};
