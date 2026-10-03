// Vue pour l'écran "Cascade" du gérant, calculée à partir de l'état réel de l'app (lib/inapp).
import { localTime, localTimeWithSeconds } from "@/lib/inapp/time";
import { isTonightReport } from "@/lib/inapp/simulate";
import { TONIGHT_SHIFT_PREFIX } from "@/lib/inapp/state";
import type { AppState, ShiftReport } from "@/lib/inapp/types";

export type DemoDashboardState = {
  mode: "live";
  simulated: boolean;
  status: "idle" | "calling" | "resolved";
  updatedAt: string;
  managerNotification: string | null;
  roster: Array<{
    id: string;
    name: string;
    role: string;
    phone: string;
    // scheduled : en poste ce soir · available : extra disponible · queued : dans la file d'appel
    // called : appelé en ce moment · declined / accepted : réponse reçue · absent : n'a pas pointé
    status: "scheduled" | "available" | "queued" | "called" | "declined" | "accepted" | "absent";
  }>;
  schedule: Array<{
    id: string;
    role: string;
    startsAt: string;
    endsAt: string;
    status: "scheduled" | "vacant" | "covered";
    employeeName: string | null;
    replacementFor: string | null;
  }>;
  currentCase: null | {
    id: string;
    trigger: "no_show" | "sick_sms";
    absentEmployee: string;
    replacementEmployee: string | null;
    shiftRole: string;
    startsAt: string;
    endsAt: string;
    candidateCount: number;
    cascadeStatus: string;
  };
  // `at` : instant exact (ISO) · `time` : heure du restaurant avec secondes, ex. "19:00:05"
  timeline: Array<{ type: string; message: string; at: string; time: string }>;
};

const roleLabel = (role: string) => ({ salle: "Salle", cuisine: "Cuisine", bar: "Bar" })[role] ?? role;

function latestTonightReport(app: AppState): ShiftReport | undefined {
  return [...app.reports].filter((r) => isTonightReport(app, r)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function buildDemoState(app: AppState, now: Date): DemoDashboardState {
  const name = (id: string | null) => app.employees.find((e) => e.id === id)?.name ?? null;
  const tonight = app.shifts.filter((s) => s.id.startsWith(TONIGHT_SHIFT_PREFIX));
  const report = latestTonightReport(app);
  const reportShiftRow = report ? app.shifts.find((s) => s.id === report.shift_id) : undefined;
  const offers = report ? app.offers.filter((o) => o.report_id === report.id) : [];
  const firstPending = offers.find((o) => o.status === "pending");

  const roster = app.employees.map((employee) => {
    const onShiftTonight = tonight.some((s) => s.id === `${TONIGHT_SHIFT_PREFIX}${employee.id}`);
    let status: DemoDashboardState["roster"][number]["status"] = onShiftTonight ? "scheduled" : "available";

    if (report && employee.id === report.employee_id) status = "absent";
    const offer = offers.find((o) => o.employee_id === employee.id);
    if (offer) {
      if (offer.status === "accepted") status = "accepted";
      else if (offer.status === "declined" || offer.status === "rejected") status = "declined";
      else if (offer.status === "pending") status = offer === firstPending ? "called" : "queued";
    }
    return { id: employee.id, name: employee.name, role: roleLabel(employee.role), phone: employee.phone, status };
  });

  const schedule = tonight.map((s) => ({
    id: s.id,
    role: roleLabel(s.role),
    startsAt: localTime(s.starts_at),
    endsAt: localTime(s.ends_at),
    status: (s.status === "cancelled" ? "scheduled" : s.status) as "scheduled" | "vacant" | "covered",
    employeeName: name(s.employee_id),
    replacementFor: name(s.replacement_for_employee_id ?? null),
  }));

  let managerNotification: string | null = null;
  let status: DemoDashboardState["status"] = "idle";
  if (report) {
    const absent = name(report.employee_id);
    const replacement = name(report.accepted_employee_id);
    const calling = roster.find((r) => r.status === "called")?.name;
    if (report.status === "resolved") {
      status = "resolved";
      managerNotification = `${absent} n'a pas pointé. J'ai géré : ${replacement} couvre son shift.`;
    } else if (report.status === "unresolved") {
      status = "resolved";
      managerNotification = `${absent} n'a pas pointé et personne ne peut le remplacer. Il faut agir.`;
    } else {
      status = "calling";
      managerNotification = calling ? `${absent} n'a pas pointé. J'appelle ${calling}…` : `${absent} n'a pas pointé. Recherche d'un remplaçant…`;
    }
  }

  return {
    mode: "live",
    simulated: false,
    status,
    updatedAt: now.toISOString(),
    managerNotification,
    roster,
    schedule,
    currentCase:
      report && reportShiftRow
        ? {
            id: report.id,
            trigger: report.kind === "no_show" ? "no_show" : "sick_sms",
            absentEmployee: name(report.employee_id) ?? "",
            replacementEmployee: name(report.accepted_employee_id),
            shiftRole: roleLabel(reportShiftRow.role),
            startsAt: localTime(reportShiftRow.starts_at),
            endsAt: localTime(reportShiftRow.ends_at),
            candidateCount: offers.length,
            cascadeStatus: report.status,
          }
        : null,
    timeline: report ? app.events
          .filter((e) => e.report_id === report.id)
          .map((e) => ({ type: e.type, message: e.message, at: e.created_at, time: localTimeWithSeconds(e.created_at) })) : [],
  };
}
