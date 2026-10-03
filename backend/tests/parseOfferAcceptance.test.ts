import { describe, expect, it } from "vitest";

import { parseOfferAcceptance } from "@/lib/voice/parseOfferAcceptance";

describe("parseOfferAcceptance", () => {
  it("accepts keypad 1", () => {
    expect(parseOfferAcceptance({ digits: "1", speech: null })).toBe(true);
  });

  it("declines keypad 2 even if speech is positive", () => {
    expect(parseOfferAcceptance({ digits: "2", speech: "yes" })).toBe(false);
  });

  it("accepts natural positive speech", () => {
    expect(parseOfferAcceptance({ digits: null, speech: "Yeah, I can cover it" })).toBe(true);
  });

  it("treats unclear or negative speech as decline", () => {
    expect(parseOfferAcceptance({ digits: null, speech: "sorry, no" })).toBe(false);
    expect(parseOfferAcceptance({ digits: null, speech: null })).toBe(false);
  });
});
