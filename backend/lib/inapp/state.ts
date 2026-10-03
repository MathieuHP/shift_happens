import { optionalEnv } from "@/lib/env";
import type { Employee, Shift } from "@/lib/types";

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

function shift(
  id: string,
  employeeId: string,
  role: Shift["role"],
  day: Date,
  start: [number, number],
  end: [number, number],
  hourlyRate: number,
): Shift {
  const at = ([h, m]: [number, number]) => new Date(day.getTime() + (h * 60 + m) * 60_000).toISOString();
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

// Données de démo "Chez Odile". Les dates sont calculées à partir de `now`
// (demain et après-demain) pour que les shifts soient toujours dans le futur.
export function createSeedState(now: Date): AppState {
  // Minuit UTC, dans 1 jour et dans 2 jours. Les heures sont lues en UTC par l'API.
  const dayStart = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  const tomorrow = dayStart(1);
  const afterTomorrow = dayStart(2);

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
      employee("mathieu", "Mathieu", "bar", ["bar", "salle"], 20, now, 6, demoPhone("DEMO_PHONE_MATHIEU", "+32555000006")),
      employee("kash", "Kash", "salle", ["salle", "bar"], 30, now, 7, demoPhone("DEMO_PHONE_KASH", "+32555000007")),
    ],
    shifts: [
      shift("shift-1", "ines", "salle", tomorrow, [11, 30], [15, 30], 16),
      shift("shift-2", "lucie", "cuisine", tomorrow, [11, 30], [15, 30], 17),
      shift("shift-3", "tom", "salle", tomorrow, [18, 0], [23, 0], 16),
      shift("shift-4", "mehdi", "cuisine", tomorrow, [18, 0], [23, 0], 16),
      shift("shift-5", "jade", "bar", tomorrow, [18, 0], [23, 0], 16),
      shift("shift-6", "ines", "salle", afterTomorrow, [11, 30], [15, 30], 16),
      shift("shift-7", "jade", "bar", afterTomorrow, [18, 0], [23, 0], 16),
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
