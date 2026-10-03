// Types du flux "tout dans l'app" (voir docs/09-open-decisions.md).
import type { Employee, Shift } from "@/lib/types";

export type ReportKind = "absence" | "delay" | "no_show";

// no_show = l'employé n'a pas pointé 5 minutes avant son shift (déclenché par la démo, pas par un bouton d'employé)
// open            : absence signalée, le gérant n'a pas encore lancé la recherche
// delay_noted     : retard signalé, le gérant est prévenu (pas de recherche automatique)
// searching       : offres envoyées aux remplaçants éligibles
// pending_approval: un remplaçant a accepté, le gérant doit confirmer (si l'approbation est activée)
// resolved        : remplaçant affecté
// unresolved      : personne n'a pu / voulu remplacer -> alerte gérant
export type ReportStatus =
  | "open"
  | "delay_noted"
  | "searching"
  | "pending_approval"
  | "resolved"
  | "unresolved";

export type ShiftReport = {
  id: string;
  shift_id: string;
  employee_id: string;
  kind: ReportKind;
  eta: string | null; // heure d'arrivée estimée, ex. "18:20" (retard seulement)
  status: ReportStatus;
  accepted_employee_id: string | null;
  created_at: string;
};

export type OfferStatus = "pending" | "accepted" | "declined" | "closed" | "rejected";

export type Offer = {
  id: string;
  report_id: string;
  shift_id: string;
  employee_id: string;
  status: OfferStatus;
  created_at: string;
};

export type AppEventType =
  | "absence_reported"
  | "delay_reported"
  | "no_show_detected"
  | "search_started"
  | "call_started"
  | "offer_declined"
  | "replacement_accepted"
  | "approval_requested"
  | "replacement_rejected"
  | "case_resolved"
  | "no_replacement";

export type AppEvent = {
  id: string;
  report_id: string;
  type: AppEventType;
  message: string;
  created_at: string;
};

export type Settings = {
  // Si vrai, une acceptation attend la confirmation du gérant. Par défaut : autopilot (faux).
  manager_approval_required: boolean;
};

export type AppState = {
  restaurant_name: string;
  settings: Settings;
  employees: Employee[];
  shifts: Shift[];
  reports: ShiftReport[];
  offers: Offer[];
  events: AppEvent[];
};

// Erreur "métier" : le code HTTP est choisi par la route qui l'attrape.
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}
