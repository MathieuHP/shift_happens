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
  // Délai (en secondes) avant de passer au candidat suivant quand un appel reste sans réponse. null = pas de minuterie.
  call_timeout_seconds: number | null;
  created_at: string;
};

// no_answer : l'appel est resté sans réponse pendant le délai prévu (le candidat perd son tour)
// skipped : le candidat n'a pas été appelé (pas de consentement, hors plage horaire)
export type OfferStatus = "pending" | "accepted" | "declined" | "closed" | "rejected" | "no_answer" | "skipped";

export type Offer = {
  id: string;
  report_id: string;
  shift_id: string;
  employee_id: string;
  status: OfferStatus;
  // Instant où l'appel à ce candidat a commencé (sert au délai). null = pas appelé pour l'instant.
  called_at: string | null;
  created_at: string;
};

// Un appel vocal à un candidat (une offre = au plus un appel).
// queued : demandé par le serveur, pas encore lancé · dialing : en cours d'envoi au fournisseur
// calling : lancé (la personne est jointe ou le téléphone sonne) · no_answer / failed / skipped : tour terminé sans réponse
// completed : réponse reçue ou offre devenue sans objet
export type VoiceCallStatus = "queued" | "dialing" | "calling" | "no_answer" | "failed" | "skipped" | "completed";

export type VoiceCall = {
  id: string;
  offer_id: string;
  report_id: string;
  employee_id: string;
  idempotency_key: string; // une offre = un appel : rejouer la demande ne rappelle jamais
  status: VoiceCallStatus;
  provider: "simulated" | "elevenlabs" | null;
  conversation_id: string | null; // identifiant ElevenLabs : sert à retrouver l'offre quand l'agent répond
  call_sid: string | null; // identifiant Twilio
  failure: string | null;
  answered_at: string | null; // la personne a décroché : tant que la conversation dure, le délai de 30 s ne s'applique plus
  checked_at: string | null; // dernière fois qu'on a demandé l'état de l'appel au fournisseur
  created_at: string;
};

export type AppEventType =
  | "absence_reported"
  | "delay_reported"
  | "no_show_detected"
  | "search_started"
  | "call_started"
  | "call_placed"
  | "call_answered"
  | "call_no_answer"
  | "call_failed"
  | "call_skipped"
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
  calls: VoiceCall[];
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
