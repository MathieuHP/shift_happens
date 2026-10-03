# Product brief — ShiftVoice

## Problem and user
A restaurant employee who cannot make a shift usually phones or texts the manager, often minutes or hours before service. The manager then works through a mental list of people who might be qualified and free. ShiftVoice takes the callout by phone, structures it, and runs an approved, ordered search for cover while the manager keeps control.

## Why voice (assumption to test, not a fact)
Hospitality staff call in sick; they do not open a scheduling app. Existing tools (Deputy, Planday, Combo…) offer shift-swap/broadcast mostly via app or SMS push. Our bet: a phone call that is answered by a voice agent removes the app step on both sides (the absent employee and the replacement). During the demo we test this by measuring what is really saved: manager time from callout to a held acceptance. These are hypotheses, not proven savings.

## Product boundary
`Employee callout → identified shift → manager approves outreach → eligible replacements contacted → acceptance held → manager confirms.`

It is not payroll, legal-policy enforcement, automatic staff assignment, or scheduling. Later phases are in `ROADMAP.md` and must not leak into the MVP.

## Principles
1. The voice agent proposes; application code and the manager decide.
2. Urgency is a first-class concept: every case has a deadline (shift start) and the manager is notified, not just shown a dashboard.
3. Acceptance is not assignment.
4. Billing never touches shift state.
5. Every mock is labeled; every state transition, eligibility rule and entitlement check is real.

## Hackathon success (scripted, not statistical)
We run a scripted set of 10 seeded callout calls/phrases and report the real counts. We do not claim a success rate beyond that.
- Scripted callouts: correct employee/shift identified, or safely routed to manager review.
- Eligibility output equals the expected result for every seeded acceptance test.
- Manager can approve outreach in one action from the case screen.
- Exactly one acceptance is held; no double assignment under a race test.
- Demo visibly shows: Stripe test checkout → entitlement, an ElevenLabs voice interaction (or labeled mock), the full state machine to `filled`.

## Demo assumptions
One restaurant, one location, one manager, seeded employees/shifts, one plan, test phone numbers, Stripe test mode. Providers can be mocked behind adapters; the application logic cannot.

## Pricing
Hypothesis only. Anchor: cost of an uncovered or late-covered shift versus a monthly subscription. €99–€299/month is a placeholder to validate with real restaurant owners.
