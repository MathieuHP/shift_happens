# Product brief — ShiftVoice

## Problem and user
A restaurant employee who is late or missing at the start of a shift creates an urgent staffing problem. ShiftVoice monitors employee-specific check-ins, calls the scheduled employee when no check-in appears, and runs an ordered search for cover while the manager keeps control.

## Why voice (assumption to test, not a fact)
Hospitality shifts can be understaffed before anyone notices. Existing tools (Deputy, Planday, Combo…) offer check-in and shift-swap workflows, but the manager may still need to chase a missing employee and then contact replacements. Our bet: a short outbound voice check followed by a deterministic replacement cascade saves manager time. During the demo we measure time from missing check-in to a held acceptance. These are hypotheses, not proven savings.

## Product boundary
`Missing employee-specific QR check-in → call scheduled employee → eligible replacements contacted → acceptance held or assigned → manager confirms when configured.`

It is not payroll, legal-policy enforcement, automatic staff assignment, or scheduling. Later phases are in `ROADMAP.md` and must not leak into the MVP.

## Principles
1. The voice agent proposes; application code and the manager decide.
2. Urgency is a first-class concept: every case has a deadline (shift start) and the manager is notified, not just shown a dashboard.
3. Acceptance is not assignment unless the manager enables automatic assignment.
4. Billing never touches shift state.
5. Every mock is labeled; every state transition, eligibility rule and entitlement check is real.

## Hackathon success (scripted, not statistical)
We run a scripted set of 10 seeded attendance and response scenarios and report the real counts. We do not claim a success rate beyond that.
- Scripted attendance scenarios: valid check-in, late declaration, "on my way", absence, no answer, and unclear response.
- Eligibility output equals the expected result for every seeded acceptance test.
- Manager can choose automatic assignment or manager confirmation for replacements.
- Exactly one acceptance is held or assigned; no double assignment under a race test.
- Demo visibly shows: Stripe test checkout → entitlement, missing QR check-in → outbound voice calls, and the full state machine to `filled`.

## Demo assumptions
One restaurant, one location, one manager, seeded employees/shifts, employee-specific QR codes, one plan, test phone numbers, Stripe test mode. Providers can be mocked behind adapters; the application logic cannot.

## Pricing
Hypothesis only. Anchor: cost of an uncovered or late-covered shift versus a monthly subscription. €99–€299/month is a placeholder to validate with real restaurant owners.
