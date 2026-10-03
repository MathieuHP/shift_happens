# Verification plan

Tests are grouped by feature; run a feature's tests before starting the next.

## F1–F2: lifecycle and eligibility
1. Illegal transition (e.g. approve a `filled` case, or manager action without session) is rejected.
2. Seeded eligibility scenarios, each expected result written down in advance:
   - inactive employee → excluded; wrong role/skill → excluded
   - availability only partially covers the shift → excluded
   - overlapping assigned shift → excluded; rest < minimum → excluded
   - no contact consent or outside contact window → excluded
   - ordering: least recent offer first, stable tie-break
3. Eligibility result is identical regardless of attendance-call wording or provider response metadata.

## F3: offers and confirmation
4. First candidate declines → next gets the offer; timeout advances too.
5. First acceptance → `accepted_pending_manager`, remaining offers `closed`, shift unassigned.
6. Two acceptances race → exactly one held.
7. Repeated confirmation → rejected safely; one assignment.
8. Empty/exhausted list → `no_candidate` + alert.

## F4: urgency
9. Recovery-case creation notifies; unresolved case is reminded after the delay; shift start without fill → `expired`/flag.

## F5: outbound attendance recovery
10. Employee-specific signed QR is accepted only for the assigned employee and shift; expired, reused, wrong-employee, and malformed tokens are rejected.
11. Check-in is accepted from `T−10`; a valid check-in prevents recovery. A late declaration before `T−5` prevents recovery and is visible to the manager.
12. At `T−5`, missing check-in creates exactly one recovery case; replayed scheduler execution does not duplicate it.
13. Scheduled-employee call records `on_my_way`, `absent`, `no_answer`, and `unclear`; `on_my_way` stops the cascade and the other outcomes start replacement outreach.
14. Replacement calls are sequential; decline, timeout, no answer, and failure advance once; provider callback replay does not start duplicate calls.
15. Manual mode holds the first acceptance as `accepted_pending_manager`; automatic mode assigns it atomically; concurrent acceptances produce one result.

## F6: Stripe
14. Checkout → verified webhook → entitlement active.
15. Replayed webhook → one effect; out-of-order event reconciled.
16. Cancelled/inactive → new intake/outreach blocked; existing cases unchanged.
17. Redirect without webhook → not active.

## F7: absorbed into F5
Outbound offer coverage is tested under F5.

## F8: time-off
19. Time-off stays `pending`, never shown as approved.

## Cross-cutting
20. ElevenLabs unavailable → manual/mock path completes transitions with audit.
21. Duplicate provider event replay → no duplicate case/offer/assignment.

## Acceptance gate
- [ ] State machine and manager-only authorization/assignment enforced by the server.
- [ ] Eligibility is application code only.
- [ ] Manual mode has no assignment before manager confirmation; automatic mode assigns only the first valid acceptance.
- [ ] Stripe webhook updates entitlement only, idempotently.
- [ ] No raw transcript/audio persisted; no medical reason requested.
- [ ] Test numbers only; every mock labeled.

## Two-minute demo narrative
**0:00–0:20** Manager completes Stripe test checkout; webhook activates the account.
**0:20–0:45** Employee has no valid QR check-in by `T−5`; the recovery case appears with the attendance deadline.
**0:45–1:05** ElevenLabs calls the scheduled employee; “absent” or no answer starts the replacement cascade.
**1:05–1:35** First candidate declines, next accepts; show either held acceptance or automatic assignment according to manager setting.
**1:35–2:00** Manager confirms in manual mode or the system completes automatic assignment; show `filled`, audit trail, and billing isolation.

## Metrics to report
Scripted-run outcome counts, valid/rejected check-ins, time from `T−5` to scheduled-employee response, time to held/assigned replacement, offers per fill, webhook replays handled.
