import { optionalEnv } from "@/lib/env";

// Les horaires affichés (et un jour la voix) sont ceux du restaurant, pas ceux du serveur ni UTC.
export function restaurantTimezone() {
  return optionalEnv("RESTAURANT_TIMEZONE") ?? "Europe/Brussels";
}

function parts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: restaurantTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: string) => Number(formatter.formatToParts(date).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

const pad = (n: number) => String(n).padStart(2, "0");

// "2026-10-04T16:00:00Z" -> "2026-10-04" / "18:00" (heure du restaurant)
export function localDate(iso: string) {
  const p = parts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function localTime(iso: string) {
  const p = parts(new Date(iso));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// "2026-10-04T16:00:05Z" -> "18:00:05" : heure précise d'une action, pour la timeline
export function localTimeWithSeconds(iso: string) {
  const p = parts(new Date(iso));
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

// Jour calendaire (année, mois 1-12, jour) du restaurant à l'instant `now`.
export function localCalendarDay(now: Date) {
  const { year, month, day } = parts(now);
  return { year, month, day };
}

// Décalage du fuseau par rapport à UTC, en millisecondes, à cet instant (+2 h = 7 200 000 en été à Bruxelles).
function offsetMs(date: Date) {
  const p = parts(date);
  const minuteStart = date.getTime() - (date.getTime() % 60_000);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - minuteStart;
}

// Heure "murale" du restaurant -> instant UTC en ISO. Ex. 18:00 le 4 octobre à Bruxelles = 16:00Z.
export function zonedTimeToIso(year: number, month: number, day: number, hour: number, minute: number) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess));
  let instant = guess - first;
  const second = offsetMs(new Date(instant)); // corrige le cas du changement d'heure
  if (second !== first) instant = guess - second;
  return new Date(instant).toISOString();
}
