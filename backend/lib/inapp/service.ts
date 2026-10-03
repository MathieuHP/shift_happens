// Règles métier du flux "tout dans l'app".
// Chaque fonction reçoit l'état (`state`) et l'heure (`now`) : pas d'accès caché au réseau
// ni à l'horloge, donc faciles à tester. L'éligibilité reste du code déterministe.
import { getEligibleCandidates } from "@/lib/matching/eligibleCandidates";
import type { Shift } from "@/lib/types";

import { optionalEnv } from "@/lib/env";

import { localDate, localTime } from "./time";

import {
  DomainError,
  type AppEvent,
  type AppEventType,
  type AppState,
  type Offer,
  type ReportKind,
  type Settings,
  type ShiftReport,
} from "./types";

function addEvent(state: AppState, reportId: string, type: AppEventType, message: string, now: Date) {
  const event: AppEvent = {
    id: crypto.randomUUID(),
    report_id: reportId,
    type,
    message,
    created_at: now.toISOString(),
  };
  state.events.push(event);
}

function findReport(state: AppState, reportId: string) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) throw new DomainError("report_not_found", "Signalement introuvable.", 404);
  return report;
}

function findShift(state: AppState, shiftId: string) {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) throw new DomainError("shift_not_found", "Shift introuvable.", 404);
  return shift;
}

function employeeName(state: AppState, id: string | null) {
  return state.employees.find((e) => e.id === id)?.name ?? "Quelqu'un";
}

// ---------- 1. L'employé signale un retard ou une absence ----------

export function reportShift(
  state: AppState,
  input: { employeeId: string; shiftId: string; kind: ReportKind; eta?: string | null },
  now: Date,
): { report: ShiftReport; created: boolean } {
  const employee = state.employees.find((e) => e.id === input.employeeId && e.active);
  if (!employee) throw new DomainError("employee_not_found", "Employé introuvable.", 404);

  const shift = findShift(state, input.shiftId);
  // Un employé ne peut signaler que son propre shift, encore à venir.
  if (shift.employee_id !== employee.id || shift.status !== "scheduled") {
    throw new DomainError("not_your_shift", "Ce shift n'est pas le vôtre.", 403);
  }
  if (new Date(shift.starts_at) <= now) {
    throw new DomainError("shift_started", "Ce shift a déjà commencé.", 409);
  }

  // Idempotent : un seul signalement par employé, shift et type.
  const existing = state.reports.find(
    (r) => r.employee_id === employee.id && r.shift_id === shift.id && r.kind === input.kind,
  );
  if (existing) return { report: existing, created: false };

  const report: ShiftReport = {
    id: crypto.randomUUID(),
    shift_id: shift.id,
    employee_id: employee.id,
    kind: input.kind,
    eta: input.kind === "delay" ? (input.eta ?? null) : null,
    status: input.kind === "delay" ? "delay_noted" : "open",
    accepted_employee_id: null,
    call_timeout_seconds: null,
    created_at: now.toISOString(),
  };
  state.reports.push(report);

  const messages: Record<ReportKind, string> = {
    absence: `${employee.name} signale une absence.`,
    delay: `${employee.name} signale un retard${report.eta ? ` (arrivée vers ${report.eta})` : ""}.`,
    no_show: `${employee.name} n'a pas pointé : son shift commence dans 5 minutes.`,
  };
  const types = { absence: "absence_reported", delay: "delay_reported", no_show: "no_show_detected" } as const;
  addEvent(state, report.id, types[input.kind], messages[input.kind], now);

  return { report, created: true };
}

// ---------- 2. Le gérant lance la recherche d'un remplaçant ----------

// Délai par défaut avant de passer au candidat suivant quand un appel reste sans réponse (CALL_TIMEOUT_SECONDS).
export function callTimeoutSeconds() {
  const value = Number(optionalEnv("CALL_TIMEOUT_SECONDS"));
  return Number.isFinite(value) && value > 0 ? value : 30;
}

// Plafond de sécurité : une conversation qui dure plus longtemps que ça (agent bloqué, ligne ouverte) cesse de retenir le tour.
export function callMaxSeconds() {
  const value = Number(optionalEnv("CALL_MAX_SECONDS"));
  return Number.isFinite(value) && value > 0 ? value : 180;
}

// options.callTimeoutSeconds : active la minuterie d'appel pour cette recherche (null/absent = offres sans minuterie).
export function findReplacement(state: AppState, reportId: string, now: Date, options: { callTimeoutSeconds?: number } = {}) {
  advanceExpiredCalls(state, now);
  const report = findReport(state, reportId);

  if (report.status === "searching" || report.status === "pending_approval") {
    return { report, offers: offersOfReport(state, report.id), candidateCount: 0, alreadyStarted: true };
  }
  if (report.status === "resolved") {
    throw new DomainError("already_resolved", "Ce shift a déjà un remplaçant.", 409);
  }

  const shift = findShift(state, report.shift_id);
  if (new Date(shift.starts_at) <= now) {
    throw new DomainError("shift_started", "Ce shift a déjà commencé.", 409);
  }

  // Le shift devient vacant le temps de la recherche.
  shift.employee_id = null;
  shift.status = "vacant";

  const candidates = getEligibleCandidates({
    employees: state.employees,
    shifts: state.shifts,
    shift,
    absentEmployeeId: report.employee_id,
  });

  if (candidates.length === 0) {
    report.status = "unresolved";
    addEvent(state, report.id, "no_replacement", "Aucun remplaçant éligible trouvé : à vous de jouer.", now);
    return { report, offers: [], candidateCount: 0, alreadyStarted: false };
  }

  const offers: Offer[] = candidates.map((candidate) => ({
    id: crypto.randomUUID(),
    report_id: report.id,
    shift_id: shift.id,
    employee_id: candidate.id,
    status: "pending",
    called_at: null,
    created_at: now.toISOString(),
  }));
  state.offers.push(...offers);
  report.status = "searching";
  // La minuterie (et donc les appels) est active pour la démo, et pour toute recherche quand la voix est activée.
  report.call_timeout_seconds = options.callTimeoutSeconds ?? (optionalEnv("VOICE_ENABLED") === "true" ? callTimeoutSeconds() : null);
  addEvent(state, report.id, "search_started", `Offre envoyée à ${candidates.map((c) => c.name).join(", puis ")}.`, now);
  announceNextCall(state, report.id, now);

  return { report, offers, candidateCount: candidates.length, alreadyStarted: false };
}

// Le prochain candidat à appeler = la première offre encore en attente (l'ordre est celui de l'éligibilité).
// On le note dans la timeline et, si les appels sont actifs (minuterie), on demande un appel : il part ensuite
// vers ElevenLabs via `dispatchPendingCalls` (lib/voice/dispatchCalls.ts), qui est asynchrone.
function announceNextCall(state: AppState, reportId: string, now: Date) {
  const next = state.offers.find((o) => o.report_id === reportId && o.status === "pending");
  if (!next) return;
  if (findReport(state, reportId).call_timeout_seconds) {
    next.called_at = now.toISOString();
    state.calls.push({
      id: crypto.randomUUID(),
      offer_id: next.id,
      report_id: reportId,
      employee_id: next.employee_id,
      idempotency_key: `offer:${next.id}`,
      status: "queued",
      provider: null,
      conversation_id: null,
      call_sid: null,
      failure: null,
      answered_at: null,
      checked_at: null,
      created_at: now.toISOString(),
    });
  }
  addEvent(state, reportId, "call_started", `Appel de ${employeeName(state, next.employee_id)}…`, now);
}

// Termine le tour du candidat actuel (sans réponse, appel échoué, non contacté), puis passe au suivant.
// S'il n'y en a plus, le gérant est alerté.
function endTurn(
  state: AppState,
  offer: Offer,
  input: { status: "no_answer" | "skipped"; eventType: AppEventType; message: (hasNext: boolean) => string; noneLeft: string },
  at: Date,
) {
  offer.status = input.status;
  const report = findReport(state, offer.report_id);
  const hasNext = state.offers.some((o) => o.report_id === report.id && o.status === "pending");
  addEvent(state, report.id, input.eventType, input.message(hasNext), at);

  if (hasNext) {
    announceNextCall(state, report.id, at);
  } else {
    report.status = "unresolved";
    addEvent(state, report.id, "no_replacement", input.noneLeft, at);
  }
}

const NO_ANSWER_LEFT = "Personne n'a répondu : aucun remplaçant.";
const NONE_REACHED = "Personne n'a pu être joint : aucun remplaçant.";

function activeOffer(state: AppState, offerId: string) {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== "pending") return null;
  return findReport(state, offer.report_id).status === "searching" ? offer : null;
}

// Passe au candidat suivant quand un appel reste sans réponse pendant le délai prévu (30 s par défaut).
// Fonction idempotente : on peut l'appeler à chaque lecture. Si plusieurs délais se sont écoulés depuis le
// dernier appel (personne n'a consulté l'état), on les rejoue dans l'ordre, avec les vraies heures dans la timeline.
// Renvoie le nombre de délais dépassés traités.
export function advanceExpiredCalls(state: AppState, now: Date) {
  let expired = 0;
  for (const report of state.reports) {
    const timeout = report.call_timeout_seconds;
    if (report.status !== "searching" || !timeout) continue;

    while (report.status === "searching") {
      const current = state.offers.find((o) => o.report_id === report.id && o.status === "pending");
      if (!current?.called_at) break;
      const call = state.calls.find((c) => c.offer_id === current.id);
      // Tant que la personne répond (elle a décroché), le délai de 30 s ne s'enclenche pas : seul un plafond de sécurité s'applique.
      const talking = call?.status === "calling" && call.answered_at !== null;
      const expiresAt = talking
        ? new Date(new Date(call.answered_at as string).getTime() + callMaxSeconds() * 1000)
        : new Date(new Date(current.called_at).getTime() + timeout * 1000);
      if (expiresAt > now) break;

      if (call && ["queued", "dialing", "calling"].includes(call.status)) call.status = "no_answer";
      const name = employeeName(state, current.employee_id);
      endTurn(
        state,
        current,
        {
          status: "no_answer",
          eventType: "call_no_answer",
          message: (hasNext) =>
            talking
              ? `${name} : conversation trop longue (${callMaxSeconds()} s) sans réponse${hasNext ? " : on passe au suivant." : "."}`
              : `${name} n'a pas répondu (${timeout} s)${hasNext ? " : on passe au suivant." : "."}`,
          noneLeft: NO_ANSWER_LEFT,
        },
        expiresAt,
      );
      expired += 1;
    }
  }
  return expired;
}

// Le candidat ne peut pas être appelé (pas de consentement, hors plage horaire) : on passe au suivant.
export function skipCall(state: AppState, offerId: string, reason: string, now: Date) {
  const offer = activeOffer(state, offerId);
  if (!offer) return false;
  const call = state.calls.find((c) => c.offer_id === offer.id);
  if (call) {
    call.status = "skipped";
    call.failure = reason;
  }
  const name = employeeName(state, offer.employee_id);
  endTurn(
    state,
    offer,
    { status: "skipped", eventType: "call_skipped", message: () => `${name} n'est pas appelé : ${reason}.`, noneLeft: NONE_REACHED },
    now,
  );
  return true;
}

// Le fournisseur n'a pas pu lancer l'appel, ou l'a signalé comme échoué : on passe au suivant tout de suite.
// Raison courte pour la timeline : une seule ligne, sans clé ni identifiant.
function shortReason(reason: string) {
  const oneLine = reason.replace(/\s+/g, " ").trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 137)}…` : oneLine || "raison inconnue";
}

export function failCall(state: AppState, callId: string, reason: string, now: Date) {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || !["dialing", "calling"].includes(call.status)) return false;
  call.status = "failed";
  call.failure = reason;
  const offer = activeOffer(state, call.offer_id);
  if (!offer) return false;
  const name = employeeName(state, offer.employee_id);
  endTurn(
    state,
    offer,
    {
      status: "no_answer",
      eventType: "call_failed",
      // La raison (ex. « pays non autorisé chez Twilio ») est affichée pour pouvoir corriger vite en test.
      message: (hasNext) => `L'appel vers ${name} a échoué (${shortReason(reason)})${hasNext ? " : on passe au suivant." : "."}`,
      noneLeft: NONE_REACHED,
    },
    now,
  );
  return true;
}

// Le fournisseur signale « occupé » ou « injoignable » : même effet qu'un délai dépassé, sans attendre la fin du délai.
export function endCallNoAnswer(state: AppState, callId: string, now: Date, cause = "occupé ou injoignable") {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || !["dialing", "calling"].includes(call.status)) return false;
  call.status = "no_answer";
  const offer = activeOffer(state, call.offer_id);
  if (!offer) return false;
  const name = employeeName(state, offer.employee_id);
  endTurn(
    state,
    offer,
    {
      status: "no_answer",
      eventType: "call_no_answer",
      message: (hasNext) => `${name} n'a pas répondu (${cause})${hasNext ? " : on passe au suivant." : "."}`,
      noneLeft: NO_ANSWER_LEFT,
    },
    now,
  );
  return true;
}

// L'appel a été lancé chez le fournisseur : on garde ses identifiants (ils servent à retrouver l'offre quand l'agent répond).
export function recordCallPlaced(
  state: AppState,
  callId: string,
  result: { mode: "simulated" | "live"; conversationId: string | null; callSid: string | null },
  now: Date,
) {
  const call = state.calls.find((c) => c.id === callId);
  if (!call) return;
  if (call.status === "dialing") call.status = "calling";
  call.provider = result.mode === "live" ? "elevenlabs" : "simulated";
  call.conversation_id = result.conversationId;
  call.call_sid = result.callSid;
  const name = employeeName(state, call.employee_id);
  addEvent(state, call.report_id, "call_placed", `[${result.mode === "live" ? "LIVE" : "SIMULÉ"}] Appel lancé vers ${name}.`, now);
}

// La personne a décroché : le délai de 30 s est suspendu tant que la conversation dure.
export function markCallAnswered(state: AppState, callId: string, now: Date) {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || call.status !== "calling" || call.answered_at) return false;
  if (!activeOffer(state, call.offer_id)) return false;
  call.answered_at = now.toISOString();
  addEvent(state, call.report_id, "call_answered", `${employeeName(state, call.employee_id)} a décroché.`, now);
  return true;
}

function completeCall(state: AppState, offerId: string) {
  const call = state.calls.find((c) => c.offer_id === offerId);
  if (call && ["queued", "dialing", "calling"].includes(call.status)) call.status = "completed";
}

function offersOfReport(state: AppState, reportId: string) {
  return state.offers.filter((o) => o.report_id === reportId);
}

// ---------- 3. Le remplaçant accepte ou refuse dans l'app ----------

export type OfferOutcome =
  | { outcome: "accepted" }
  | { outcome: "pending_approval" }
  | { outcome: "declined" }
  | { outcome: "ignored"; reason: string };

export function respondToOffer(
  state: AppState,
  input: { offerId: string; employeeId: string; accept: boolean },
  now: Date,
): OfferOutcome {
  advanceExpiredCalls(state, now);
  const offer = state.offers.find((o) => o.id === input.offerId);
  if (!offer) throw new DomainError("offer_not_found", "Offre introuvable.", 404);
  if (offer.employee_id !== input.employeeId) {
    throw new DomainError("not_your_offer", "Cette offre n'est pas pour vous.", 403);
  }

  // Réponse en double ou tardive : on ne touche à rien.
  if (offer.status !== "pending") return { outcome: "ignored", reason: offer.status };

  const report = findReport(state, offer.report_id);
  const shift = findShift(state, offer.shift_id);
  if (report.status !== "searching" || shift.status !== "vacant" || new Date(shift.starts_at) <= now) {
    offer.status = "closed";
    return { outcome: "ignored", reason: "closed" };
  }

  const name = employeeName(state, offer.employee_id);

  if (!input.accept) {
    offer.status = "declined";
    completeCall(state, offer.id);
    addEvent(state, report.id, "offer_declined", `${name} a refusé le shift.`, now);
    // Plus personne à attendre -> alerte gérant. Sinon on passe au candidat suivant.
    if (!state.offers.some((o) => o.report_id === report.id && o.status === "pending")) {
      report.status = "unresolved";
      addEvent(state, report.id, "no_replacement", "Tout le monde a refusé : aucun remplaçant.", now);
    } else {
      announceNextCall(state, report.id, now);
    }
    return { outcome: "declined" };
  }

  offer.status = "accepted";
  completeCall(state, offer.id);
  if (state.settings.manager_approval_required) {
    report.status = "pending_approval";
    report.accepted_employee_id = offer.employee_id;
    addEvent(state, report.id, "approval_requested", `${name} a accepté : en attente de votre confirmation.`, now);
    return { outcome: "pending_approval" };
  }

  assignReplacement(state, report, shift, offer, now);
  return { outcome: "accepted" };
}

// Affecte le remplaçant : un seul gagnant, les autres offres sont fermées.
function assignReplacement(state: AppState, report: ShiftReport, shift: Shift, offer: Offer, now: Date) {
  shift.employee_id = offer.employee_id;
  shift.status = "covered";
  shift.replacement_for_employee_id = report.employee_id;
  report.status = "resolved";
  report.accepted_employee_id = offer.employee_id;
  for (const other of offersOfReport(state, report.id)) {
    if (other.id !== offer.id && other.status === "pending") other.status = "closed";
  }
  const name = employeeName(state, offer.employee_id);
  addEvent(state, report.id, "replacement_accepted", `${name} remplace ${employeeName(state, report.employee_id)}.`, now);
  addEvent(state, report.id, "case_resolved", `Shift couvert par ${name}.`, now);
}

// ---------- 4. Approbation du gérant (si activée) ----------

export function approveReplacement(state: AppState, reportId: string, now: Date) {
  const report = findReport(state, reportId);
  if (report.status !== "pending_approval") {
    throw new DomainError("nothing_to_approve", "Aucun remplaçant en attente de confirmation.", 409);
  }
  const offer = offersOfReport(state, report.id).find((o) => o.status === "accepted");
  if (!offer) throw new DomainError("nothing_to_approve", "Aucun remplaçant en attente de confirmation.", 409);

  assignReplacement(state, report, findShift(state, report.shift_id), offer, now);
  return report;
}

export function rejectReplacement(state: AppState, reportId: string, now: Date) {
  const report = findReport(state, reportId);
  if (report.status !== "pending_approval") {
    throw new DomainError("nothing_to_reject", "Aucun remplaçant en attente de confirmation.", 409);
  }
  const offer = offersOfReport(state, report.id).find((o) => o.status === "accepted");
  if (offer) offer.status = "rejected";
  report.accepted_employee_id = null;
  report.status = "searching";
  addEvent(state, report.id, "replacement_rejected", "Vous avez refusé ce remplaçant.", now);

  if (!state.offers.some((o) => o.report_id === report.id && o.status === "pending")) {
    report.status = "unresolved";
    addEvent(state, report.id, "no_replacement", "Plus aucun remplaçant disponible.", now);
  }
  return report;
}

// ---------- 5. Ce que voient l'extra et le gérant ----------

// Les offres en attente d'un employé, au format de la carte "Shifts ouverts".
export function listOffersForEmployee(state: AppState, employeeId: string, now: Date) {
  advanceExpiredCalls(state, now);
  return state.offers
    .filter((offer) => offer.employee_id === employeeId && offer.status === "pending")
    .flatMap((offer) => {
      const report = state.reports.find((r) => r.id === offer.report_id);
      const shift = state.shifts.find((s) => s.id === offer.shift_id);
      if (!report || !shift || report.status !== "searching" || new Date(shift.starts_at) <= now) return [];

      const start = new Date(shift.starts_at);
      return [
        {
          id: offer.id,
          role: roleLabel(shift.role),
          restaurant: state.restaurant_name,
          date: localDate(shift.starts_at),
          start: localTime(shift.starts_at),
          end: localTime(shift.ends_at),
          hourly_rate: shift.hourly_rate ?? 0,
          urgent: start.getTime() - now.getTime() < 24 * 3600 * 1000, // commence dans moins de 24 h
        },
      ];
    });
}

function roleLabel(role: string) {
  return { salle: "Salle", cuisine: "Cuisine", bar: "Bar" }[role] ?? role;
}

// Les prochains shifts d'un employé (pour les boutons Retard / Absence).
export function listShiftsForEmployee(state: AppState, employeeId: string, now: Date) {
  return state.shifts
    .filter((s) => s.employee_id === employeeId && s.status === "scheduled" && new Date(s.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => ({
      id: s.id,
      role: roleLabel(s.role),
      date: localDate(s.starts_at),
      start: localTime(s.starts_at),
      end: localTime(s.ends_at),
      reported: state.reports
        .filter((r) => r.shift_id === s.id && r.employee_id === employeeId)
        .map((r) => r.kind),
    }));
}

// Les signalements pour le gérant, du plus récent au plus ancien.
export function listReports(state: AppState, now: Date = new Date()) {
  advanceExpiredCalls(state, now);
  return [...state.reports]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((report) => {
      const shift = state.shifts.find((s) => s.id === report.shift_id);
      const offers = offersOfReport(state, report.id);
      return {
        id: report.id,
        kind: report.kind,
        status: report.status,
        eta: report.eta,
        employee_name: employeeName(state, report.employee_id),
        replacement_name: report.accepted_employee_id ? employeeName(state, report.accepted_employee_id) : null,
        shift: shift
          ? {
              role: roleLabel(shift.role),
              date: localDate(shift.starts_at),
              start: localTime(shift.starts_at),
              end: localTime(shift.ends_at),
            }
          : null,
        offers_sent: offers.length,
        offers_declined: offers.filter((o) => o.status === "declined").length,
        created_at: report.created_at,
      };
    });
}

// ---------- 6. Réglages ----------

export function updateSettings(state: AppState, patch: Partial<Settings>): Settings {
  if (patch.manager_approval_required !== undefined) {
    state.settings.manager_approval_required = patch.manager_approval_required;
  }
  return state.settings;
}
