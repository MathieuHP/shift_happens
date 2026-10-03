export type ContactWindowResult =
  | { allowed: true }
  | { allowed: false; reason: "missing_consent" | "outside_contact_window" };

function localMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Could not determine local contact time");
  }
  return hour * 60 + minute;
}

function parseClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid contact window time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid contact window time: ${value}`);
  return hour * 60 + minute;
}

export function checkContactPolicy(input: {
  consentAt: string | null;
  now: Date;
  timeZone: string;
  windowStart: string;
  windowEnd: string;
}): ContactWindowResult {
  if (!input.consentAt) return { allowed: false, reason: "missing_consent" };

  const nowMinutes = localMinutes(input.now, input.timeZone);
  const start = parseClock(input.windowStart);
  const end = parseClock(input.windowEnd);
  const withinWindow = start <= end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;

  return withinWindow
    ? { allowed: true }
    : { allowed: false, reason: "outside_contact_window" };
}
