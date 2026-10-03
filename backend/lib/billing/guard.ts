import { optionalEnv } from "@/lib/env";

import { isEntitled } from "./entitlement";
import { fileBillingStore, type BillingStore } from "./store";

// Bloque les nouvelles actions (signalement, recherche de remplaçant) si l'abonnement n'est pas actif.
// Désactivé par défaut : mettre REQUIRE_SUBSCRIPTION=true dans backend/.env.local pour l'activer.
// Les données existantes restent lisibles ; seules les actions qui créent quelque chose sont bloquées.
export function requireEntitlement(store: BillingStore = fileBillingStore): Response | null {
  if (optionalEnv("REQUIRE_SUBSCRIPTION") !== "true") return null;
  if (isEntitled(store.load().subscription_status)) return null;

  return Response.json(
    { error: { code: "entitlement_inactive", message: "Abonnement inactif : abonnez-vous pour utiliser ShiftSaver." } },
    { status: 402 },
  );
}
