# Hackathon verification plan

## End-to-end scenarios
1. Restaurant completes Stripe test checkout; signed subscription webhook activates entitlement; dashboard shows active account.
2. Duplicate Stripe webhook is replayed; only one billing update/audit effect occurs.
3. Canceled/inactive subscription removes new workflow entitlement while existing shift case/offer data remains unchanged.
4. Known employee completes ElevenLabs inbound voice callout; Ingram produces expected typed intent; confirmation creates exactly one pending case.
4a. Inbound call reaches the expected ElevenLabs agent through the connected Twilio number; application correlates the Twilio `CallSid` and ElevenLabs `conversation_id` to one `VoiceInteraction`.
5. Ambiguous shift causes voice clarification; no case with guessed shift and no outreach occurs before resolution/manager approval.
6. Ingram malformed/low-confidence output falls back safely to clarification/manual review.
7. Change or corrupt Ingram output while holding inputs constant; deterministic eligibility result remains identical.
8. Manager approves; eligible first candidate declines; next accepts via ElevenLabs outbound interaction or clearly labeled mock; case waits for manager confirmation.
8a. Application starts each outbound interaction through ElevenLabs' Twilio endpoint; response IDs are persisted; decline/no-answer advances only after call status/outcome is resolved.
9. Unknown caller is unverified; no outreach until manager review/authorization.
10. Two acceptances race; only one held acceptance and one final assignment are possible.
11. Time-off request remains pending and is never labeled approved.
12. Duplicate voice/provider event is replayed; no duplicate case/offer/assignment appears.
13. ElevenLabs or Ingram unavailable; manual/mock path completes internal state transitions and retains an audit trail.

## Roadmap acceptance tests (run when those phases are built)
14. Delay button creates one notice for the employee's correct upcoming shift; manager is alerted; no outreach starts automatically.
15. QR check-in records server time once; invalid, reused, wrong-location and out-of-window codes are rejected.
16. QR scan after the configured threshold alerts the manager but does not create a callout or disciplinary score.
17. Availability collection produces a draft with deterministic constraints; alter inference output and verify assignments/eligibility do not change.
18. Leave request remains pending until manager decision; leave decision does not silently publish or alter a schedule.
19. Schedule draft with uncovered/conflicting shifts cannot be published; manager-edited valid draft publishes once and is audited.
20. Payroll adapter imports a validated amount; no amount derived from QR time or inference output.
21. Worker sees net amount, any fee and estimated timing, and must opt in before payout authorization.
22. Duplicate payout request/webhook cannot pay twice; provider failure preserves payroll liability and invokes normal payroll fallback.
23. Payout marked `paid` only after provider confirmation; unknown/late webhook reconciles against the same payout ID.
24. Delay notice submitted before T−5 suppresses the scheduled employee call and appears on manager dashboard.
25. Employee check-in by T−5 suppresses the call; at exactly T−5 with no notice/check-in, one automated call starts.
25a. Employee receives only one T−5 call; if unanswered, the system moves to the first candidate in the authorized list.
26. “I’m on my way” stops escalation; record response as self-report, not presence.
27. “I won’t attend” starts sequential eligible calls only with enabled, manager-authorized policy; no-answer after configured limit does the same.
28. Disabled automation, invalid/unclear voice response, duplicate scheduler run or no eligible candidates never causes unauthorized calls; manager gets the case.
29. One replacement acceptance stops further calls and waits for manager confirmation; no schedule assignment before confirmation.
30. Owner metrics show shift start/end/duration, checked-in and manager-confirmed attendance, late/no-response/absence counts and evidence confidence by source; changing a confidence label does not rank or penalize employees.
31. Metrics distinguish scheduled, checked-in/present, late, absence-confirmed and unconfirmed/no-response; checked-in events do not automatically become payroll hours.

## Acceptance gate
- [ ] State machine and manager-only authorization/assignment enforced by server.
- [ ] Eligibility uses application code only, independent of model output.
- [ ] No schedule mutation before manager confirmation.
- [ ] Structured inference schema, validation, confidence and safe fallback are exercised.
- [ ] Stripe test subscription and idempotent webhook update entitlement only.
- [ ] No raw transcript/audio persisted by default; no medical reason requested.
- [ ] Provider calls use test numbers; every mock is labeled.
- [ ] Twilio inbound route and ElevenLabs outbound call path are exercised with test numbers; call recording and raw transcript retention remain off.

## Two-minute demo narrative
**0:00–0:20:** Restaurant manager opens checkout in Stripe test mode; webhook changes account from pending to active and dashboard shows entitlement.
**0:20–0:55:** Employee calls the restaurant's Twilio number. ElevenLabs Conversational AI handles speech and read-back; show correlated `CallSid`/`conversation_id` plus Ingram's compact structured extraction and application validation. Ambiguous phrase triggers clarification.
**0:55–1:20:** Pending case appears. Manager sees that outreach is not yet authorized, then approves. Dashboard displays deterministic eligibility reasons.
**1:20–1:45:** Candidate declines; next candidate accepts by outbound voice or labeled mock. Case becomes `accepted_pending_manager`.
**1:45–2:00:** Manager confirms. Show `filled`, audit record and subscription status; point out the billing path did not touch shift state. Keep roadmap features out of this two-minute MVP narrative.

## Metrics
Intake completion/correction rate, inference validation and clarification rate, time to first offer/acceptance, response rate, manager actions per case, webhook replay count.

Roadmap metrics: time between delay report and scheduled start, check-in-to-call timing, no-response and absence-confirmation rates, escalation conversion, replacement response, QR check-in correction/rejection rate, availability submission completion, uncovered shifts per draft, manager edits before publication. Attendance confidence is source-data quality, not a worker score.

Phase 3 metrics: payout initiation-to-bank receipt time (provider data), payout failure/reversal rate, reconciliation exceptions, opt-in rate and fees per payout. No live worker payout in hackathon tests; use provider test mode or a labeled mock.
