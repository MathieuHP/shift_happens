import { optionalEnv } from "@/lib/env";
import type { Employee, Shift } from "@/lib/types";

import { localCalendarDay, zonedTimeToIso } from "./time";
import type { AppState } from "./types";

const GLOBAL_KEY = "__shiftsaver_inapp_state__";
const RESTAURANT_ID = "chez-odile";

// Numéro réel d'un participant de la démo, lu dans backend/.env.local (jamais écrit dans le dépôt).
// Format international obligatoire (ex. +32470123456). Sinon : faux numéro, aucun appel possible.
function demoPhone(envName: string, fallback: string) {
  const value = optionalEnv(envName);
  if (!value) return fallback;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    console.warn(`${envName} n'est pas au format international (+32…) : numéro ignoré.`);
    return fallback;
  }
  return value;
}

function employee(
  id: string,
  name: string,
  role: Employee["role"],
  skills: string[],
  priority: number,
  now: Date,
  phoneIndex: number,
  phone: string = `+3255500000${phoneIndex}`,
): Employee {
  return {
    id,
    restaurant_account_id: RESTAURANT_ID,
    name,
    phone,
    role,
    skills,
    active: true,
    priority,
    contact_consent_at: now.toISOString(),
  };
}

// Un shift à l'heure du restaurant : `dayOffset` jours après aujourd'hui, de [h, m] à [h, m].
function shift(
  id: string,
  employeeId: string,
  role: Shift["role"],
  now: Date,
  dayOffset: number,
  start: [number, number],
  end: [number, number],
  hourlyRate: number,
): Shift {
  const today = localCalendarDay(now);
  const day = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
  const at = ([h, m]: [number, number]) => zonedTimeToIso(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, m);
  return {
    id,
    restaurant_account_id: RESTAURANT_ID,
    employee_id: employeeId,
    role,
    skill_required: role,
    starts_at: at(start),
    ends_at: at(end),
    status: "scheduled",
    hourly_rate: hourlyRate,
  };
}

// Le service de CE SOIR, pour la démo de cascade : toute l'équipe fixe est déjà en poste.
// Les horaires sont relatifs à `now` : à "T−5", Jade devrait commencer dans 5 minutes ; les autres travaillent déjà.
// `anchorTonightService` les recale au moment du déclenchement (voir simulate.ts).
export const TONIGHT_SHIFT_PREFIX = "tonight-";
const TONIGHT_TEAM: Array<[string, Shift["role"], number]> = [
  ["ines", "salle", 16],
  ["tom", "salle", 16],
  ["lucie", "cuisine", 17],
  ["mehdi", "cuisine", 16],
  ["jade", "bar", 16],
];

export function anchorTonightService(shifts: Shift[], now: Date) {
  const inMinutes = (n: number) => new Date(now.getTime() + n * 60_000).toISOString();
  for (const shift of shifts) {
    if (!shift.id.startsWith(TONIGHT_SHIFT_PREFIX)) continue;
    const owner = shift.id.slice(TONIGHT_SHIFT_PREFIX.length); // "tonight-jade" -> "jade"
    // Jade n'a pas encore pointé (son shift commence dans 5 min) ; les autres sont déjà en poste.
    shift.starts_at = owner === "jade" ? inMinutes(5) : inMinutes(-90);
    shift.ends_at = inMinutes(5 * 60);
    shift.employee_id = owner;
    shift.status = "scheduled";
    shift.replacement_for_employee_id = null;
  }
}

function tonightShifts(now: Date): Shift[] {
  const shifts = TONIGHT_TEAM.map(([employeeId, role, rate]) => ({
    ...shift(`${TONIGHT_SHIFT_PREFIX}${employeeId}`, employeeId, role, now, 0, [0, 0], [0, 0], rate),
  }));
  anchorTonightService(shifts, now);
  return shifts;
}

// Données de démo "Chez Odile". Les horaires sont ceux du restaurant (Europe/Brussels) et relatifs à `now`
// (ce soir, demain et après-demain) pour que les shifts soient toujours dans le futur.
export function createSeedState(now: Date): AppState {
  return {
    restaurant_name: "Chez Odile",
    settings: { manager_approval_required: false },
    employees: [
      employee("ines", "Inès", "salle", ["salle", "bar"], 10, now, 1),
      employee("tom", "Tom", "salle", ["salle"], 20, now, 2),
      employee("lucie", "Lucie", "cuisine", ["cuisine"], 10, now, 3),
      employee("mehdi", "Mehdi", "cuisine", ["cuisine"], 20, now, 4),
      employee("jade", "Jade", "bar", ["bar"], 10, now, 5),
      // Les deux seuls extras de la démo : les vraies personnes qui recevront les appels.
      // Kash est contacté en premier, puis Mathieu (le plus petit `priority` passe d'abord).
      employee("kash", "Kash", "salle", ["salle", "bar"], 20, now, 7, demoPhone("DEMO_PHONE_KASH", "+32555000007")),
      employee("mathieu", "Mathieu", "bar", ["bar", "salle"], 30, now, 6, demoPhone("DEMO_PHONE_MATHIEU", "+32555000006")),
    ],
    shifts: [
      ...tonightShifts(now),
      shift("shift-1", "ines", "salle", now, 1, [11, 30], [15, 30], 16),
      shift("shift-2", "lucie", "cuisine", now, 1, [11, 30], [15, 30], 17),
      shift("shift-3", "tom", "salle", now, 1, [18, 0], [23, 0], 16),
      shift("shift-4", "mehdi", "cuisine", now, 1, [18, 0], [23, 0], 16),
      shift("shift-5", "jade", "bar", now, 1, [18, 0], [23, 0], 16),
      shift("shift-6", "ines", "salle", now, 2, [11, 30], [15, 30], 16),
      shift("shift-7", "jade", "bar", now, 2, [18, 0], [23, 0], 16),
    ],
    reports: [],
    offers: [],
    events: [],
  };
}

// L'état vit en mémoire dans le processus du serveur (suffisant pour la démo).
// Il se remet à zéro quand le serveur redémarre. Une version Supabase viendra plus tard.
export function getAppState(now: Date = new Date()): AppState {
  const store = globalThis as typeof globalThis & { [GLOBAL_KEY]?: AppState };
  if (!store[GLOBAL_KEY]) {
    store[GLOBAL_KEY] = createSeedState(now);
  }
  return store[GLOBAL_KEY];
}

export function resetAppState(now: Date = new Date()): AppState {
  const store = globalThis as typeof globalThis & { [GLOBAL_KEY]?: AppState };
  store[GLOBAL_KEY] = createSeedState(now);
  return store[GLOBAL_KEY];
}
