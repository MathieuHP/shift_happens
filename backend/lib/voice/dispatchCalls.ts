// Lance les appels vocaux demandés par le serveur (voir `announceNextCall` dans lib/inapp/service.ts).
// Le domaine reste synchrone : il note « appel demandé » dans l'état, et c'est ce module qui parle à ElevenLabs.
import { optionalEnv } from "@/lib/env";
import { advanceExpiredCalls, failCall, recordCallPlaced, skipCall } from "@/lib/inapp/service";
import { getAppState } from "@/lib/inapp/state";
import { restaurantTimezone } from "@/lib/inapp/time";
import type { AppState } from "@/lib/inapp/types";
import { checkContactPolicy } from "@/lib/voice/contactPolicy";
import { getVoiceProvider, getVoiceRecipient } from "@/lib/voice/getProvider";
import { buildOfferDynamicVariables } from "@/lib/voice/offerVariables";
import { syncCallStatuses } from "@/lib/voice/syncCallStatus";
import type { VoiceProvider } from "@/lib/voice/provider";

const roleLabel = (role: string) => ({ salle: "Salle", cuisine: "Cuisine", bar: "Bar" })[role] ?? role;

const SKIP_REASONS = {
  missing_consent: "pas de consentement pour être contacté",
  outside_contact_window: "hors de la plage horaire d'appel",
} as const;

export type DispatchDependencies = {
  getProvider: () => VoiceProvider;
  now: Date;
};

// Passe tous les appels « demandés » : contrôle le consentement et la plage horaire, puis lance l'appel.
// - Un seul appel est lancé par offre (clé d'idempotence = l'offre) : un second passage ne rappelle jamais.
// - Si le fournisseur échoue ou si le candidat ne peut pas être appelé, on passe tout de suite au suivant.
export async function dispatchPendingCalls(state: AppState, deps: DispatchDependencies) {
  for (;;) {
    const call = state.calls.find((c) => c.status === "queued");
    if (!call) return;
    call.status = "dialing"; // verrou : un autre passage (l'écran qui se rafraîchit, par exemple) ne le reprendra pas

    const offer = state.offers.find((o) => o.id === call.offer_id);
    const report = state.reports.find((r) => r.id === call.report_id);
    const employee = state.employees.find((e) => e.id === call.employee_id);
    const shift = state.shifts.find((s) => s.id === offer?.shift_id);
    if (!offer || offer.status !== "pending" || report?.status !== "searching" || !employee || !shift) {
      call.status = "completed"; // plus d'actualité : quelqu'un d'autre a déjà pris le shift
      continue;
    }

    const windowStart = optionalEnv("CONTACT_WINDOW_START") ?? "09:00";
    const windowEnd = optionalEnv("CONTACT_WINDOW_END") ?? "20:00";
    const policy = checkContactPolicy({
      consentAt: employee.contact_consent_at,
      now: deps.now,
      timeZone: restaurantTimezone(),
      windowStart,
      windowEnd,
    });
    if (!policy.allowed) {
      const detail = policy.reason === "outside_contact_window" ? ` (${windowStart}–${windowEnd})` : "";
      skipCall(state, offer.id, `${SKIP_REASONS[policy.reason]}${detail}`, deps.now);
      continue;
    }

    try {
      if (shift.hourly_rate == null) throw new Error("taux horaire manquant");
      const timeout = report.call_timeout_seconds ?? 30;
      const result = await deps.getProvider().placeCall({
        idempotencyKey: call.idempotency_key,
        toNumber: getVoiceRecipient(employee.phone), // DEMO_PHONE_OVERRIDE redirige tout vers un numéro de test
        dynamicVariables: buildOfferDynamicVariables({
          restaurantName: state.restaurant_name,
          employeeName: employee.name,
          role: roleLabel(shift.role),
          startsAt: shift.starts_at,
          endsAt: shift.ends_at,
          hourlyRate: shift.hourly_rate,
          responseDeadline: new Date(new Date(offer.called_at ?? deps.now).getTime() + timeout * 1000),
          timeZone: restaurantTimezone(),
          managerApprovalRequired: state.settings.manager_approval_required,
        }),
      });
      recordCallPlaced(state, call.id, result, deps.now);
    } catch (error) {
      // Le détail (clé invalide, numéro refusé…) reste dans les logs du serveur ; la timeline reste lisible.
      console.error("Voice call could not be placed", error);
      failCall(state, call.id, error instanceof Error ? error.message : "erreur inconnue", deps.now);
    }
  }
}

// Fournisseur partagé : l'identifiant du numéro ElevenLabs n'est résolu qu'une fois.
let sharedProvider: VoiceProvider | null = null;
export function getSharedVoiceProvider() {
  sharedProvider ??= getVoiceProvider();
  return sharedProvider;
}
export function resetSharedVoiceProvider() {
  sharedProvider = null;
}

// Pour les routes : lance les appels en attente sur l'état de l'application, sans jamais faire échouer la requête.
export async function runVoiceDispatch(now: Date = new Date()) {
  try {
    const state = getAppState(now);
    await syncVoiceCalls(now);
    advanceExpiredCalls(state, now);
    await dispatchPendingCalls(state, { getProvider: getSharedVoiceProvider, now });
  } catch (error) {
    console.error("Voice dispatch failed", error);
  }
}

// À appeler AVANT de calculer l'état affiché : détecte qui a décroché, pour que le délai ne l'interrompe pas.
// Sans appel en cours chez le fournisseur, ne fait rien (aucun accès réseau).
export async function syncVoiceCalls(now: Date = new Date()) {
  const state = getAppState(now);
  if (!state.calls.some((c) => c.status === "calling" && c.provider === "elevenlabs")) return;
  try {
    await syncCallStatuses(state, getSharedVoiceProvider(), now);
  } catch (error) {
    console.error("Voice status sync failed", error);
  }
}
