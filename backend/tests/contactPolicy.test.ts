import { describe, expect, it } from "vitest";
import { checkContactPolicy } from "../lib/voice/contactPolicy";

describe("checkContactPolicy", () => {
  const common = {
    consentAt: "2026-10-01T10:00:00.000Z",
    timeZone: "Europe/Brussels",
    windowStart: "09:00",
    windowEnd: "20:00",
  };

  it("blocks a candidate without recorded consent", () => {
    expect(checkContactPolicy({ ...common, consentAt: null, now: new Date("2026-10-01T10:00:00Z") }))
      .toEqual({ allowed: false, reason: "missing_consent" });
  });

  it("allows a consented candidate during the local contact window", () => {
    expect(checkContactPolicy({ ...common, now: new Date("2026-10-01T10:00:00Z") }))
      .toEqual({ allowed: true });
  });

  it("blocks outside the local contact window", () => {
    expect(checkContactPolicy({ ...common, now: new Date("2026-10-01T19:30:00Z") }))
      .toEqual({ allowed: false, reason: "outside_contact_window" });
  });
});
