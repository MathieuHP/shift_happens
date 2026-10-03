import { afterEach, describe, expect, it, vi } from "vitest";

import { findReplacement, reportShift } from "@/lib/inapp/service";
import { createSeedState } from "@/lib/inapp/state";

const now = new Date("2026-10-03T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("demo seed", () => {
  it("has Mathieu and Kash as the only extras, called in this order: Kash first", () => {
    const state = createSeedState(now);
    expect(state.employees.map((e) => e.id)).toEqual(expect.arrayContaining(["mathieu", "kash"]));
    expect(state.employees.map((e) => e.id)).not.toEqual(expect.arrayContaining(["sacha"]));

    // Jade (bar) est absente : seuls Mathieu puis Kash reçoivent une offre.
    const { report } = reportShift(state, { employeeId: "jade", shiftId: "shift-5", kind: "absence" }, now);
    findReplacement(state, report.id, now);

    expect(state.offers.map((o) => o.employee_id)).toEqual(["kash", "mathieu"]);
  });

  it("takes the real phone numbers from the environment", () => {
    vi.stubEnv("DEMO_PHONE_MATHIEU", "+32470123456");
    vi.stubEnv("DEMO_PHONE_KASH", "+33612345678");

    const state = createSeedState(now);

    expect(state.employees.find((e) => e.id === "mathieu")?.phone).toBe("+32470123456");
    expect(state.employees.find((e) => e.id === "kash")?.phone).toBe("+33612345678");
  });

  it("ignores a badly formatted number and keeps a fake one (no call possible)", () => {
    vi.stubEnv("DEMO_PHONE_MATHIEU", "0470123456");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const phone = createSeedState(now).employees.find((e) => e.id === "mathieu")?.phone;

    expect(phone).toBe("+32555000006");
  });

  it("does not put any real number in the repository defaults", () => {
    const phones = createSeedState(now).employees.map((e) => e.phone);

    expect(phones.every((phone) => phone.startsWith("+3255500"))).toBe(true);
  });
});
