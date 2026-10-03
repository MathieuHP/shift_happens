import { describe, expect, it } from "vitest";

import { localDate, localTime, zonedTimeToIso } from "@/lib/inapp/time";

describe("restaurant time (Europe/Brussels)", () => {
  it("converts a summer wall-clock time to UTC (CEST = UTC+2)", () => {
    expect(zonedTimeToIso(2026, 10, 4, 18, 0)).toBe("2026-10-04T16:00:00.000Z");
  });

  it("converts a winter wall-clock time to UTC (CET = UTC+1)", () => {
    expect(zonedTimeToIso(2026, 1, 15, 18, 0)).toBe("2026-01-15T17:00:00.000Z");
  });

  it("handles the day the clocks change (25 Oct 2026, 12:00 is already CET)", () => {
    expect(zonedTimeToIso(2026, 10, 25, 12, 0)).toBe("2026-10-25T11:00:00.000Z");
  });

  it("formats an instant in restaurant time, including across midnight", () => {
    expect(localTime("2026-10-04T16:00:00.000Z")).toBe("18:00");
    expect(localDate("2026-10-04T22:30:00.000Z")).toBe("2026-10-05"); // 00:30 le lendemain à Bruxelles
    expect(localTime("2026-10-04T22:30:00.000Z")).toBe("00:30");
  });
});
