// Démo "cascade" : toute l'équipe fixe est en poste ce soir, seuls Kash et Mathieu sont disponibles comme extras.
// Un déclenchement (no-show ou absence signalée par SMS) lance la recherche de remplaçant tout de suite,
// comme si le gérant avait autorisé la recherche à l'avance (autopilot).
import { findReplacement, reportShift } from "./service";
import { anchorTonightService, getAppState, resetAppState, TONIGHT_SHIFT_PREFIX } from "./state";
import type { AppState, ReportKind, ShiftReport } from "./types";

const ACTIVE = ["open", "searching", "pending_approval"] as const;

export function isTonightReport(state: AppState, report: ShiftReport) {
  return report.shift_id.startsWith(TONIGHT_SHIFT_PREFIX);
}

// Lance l'incident de démo : l'employé absent est Jade (bar), dont le shift commence dans 5 minutes.
// - Si un incident est déjà en cours, on le renvoie tel quel (un double clic ne crée rien de plus).
// - Sinon on repart d'un état propre, pour pouvoir rejouer la démo autant de fois qu'on veut.
export function startDemoIncident(kind: Extract<ReportKind, "no_show" | "absence">, now: Date = new Date()) {
  const running = getAppState(now).reports.find((r) => isTonightReport(getAppState(now), r) && (ACTIVE as readonly string[]).includes(r.status));
  if (running) return { report: running, started: false };

  const state = resetAppState(now);
  anchorTonightService(state.shifts, now);

  const { report } = reportShift(state, { employeeId: "jade", shiftId: `${TONIGHT_SHIFT_PREFIX}jade`, kind }, now);
  findReplacement(state, report.id, now); // les offres partent dans l'ordre : Kash, puis Mathieu
  return { report, started: true };
}
