// Règles métier du flux "tout dans l'app".
// Chaque fonction reçoit l'état (`state`) et l'heure (`now`) : pas d'accès caché au réseau
// ni à l'horloge, donc faciles à tester. L'éligibilité reste du code déterministe.
import { getEligibleCandidates } from "@/lib/matching/eligibleCandidates";
import type { Shift } from "@/lib/types";

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

export function findReplacement(state: AppState, reportId: string, now: Date) {
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
    created_at: now.toISOString(),
  }));
  state.offers.push(...offers);
  report.status = "searching";
  addEvent(state, report.id, "search_started", `Offre envoyée à ${candidates.map((c) => c.name).join(", puis ")}.`, now);
  announceNextCall(state, report.id, now);

  return { report, offers, candidateCount: candidates.length, alreadyStarted: false };
}

// Le prochain candidat à appeler = la première offre encore en attente (l'ordre est celui de l'éligibilité).
// On le note dans la timeline ; l'appel vocal automatique se branchera ici.
function announceNextCall(state: AppState, reportId: string, now: Date) {
  const next = state.offers.find((o) => o.report_id === reportId && o.status === "pending");
  if (next) addEvent(state, reportId, "call_started", `Appel de ${employeeName(state, next.employee_id)}…`, now);
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
export function listReports(state: AppState) {
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
