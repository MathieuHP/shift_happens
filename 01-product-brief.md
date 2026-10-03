# Product brief — ShiftVoice

## Problem and user
Restaurant managers receive late employee callouts and manually search for qualified, available replacements. ShiftVoice captures one callout, coordinates an approved search, and holds the result for the manager.

## Product boundary
`Employee reports a shift absence → system identifies the shift → manager approves outreach → eligible replacements are contacted → acceptance is held → manager confirms the replacement.`

The hackathon MVP remains this workflow. The product roadmap can add proactive lateness reporting and, later, availability collection and manager-led schedule drafting. It does not become payroll, legal-policy enforcement, or automatic staff assignment.

## Product roadmap extensions
- **Phase 1 — lateness and no-show escalation:** ten minutes before shift start, the check-in window opens. Employee can report expected delay in the app at any time before arrival. If there is no delay notice or check-in by five minutes after that window opens (T−5), the system calls the scheduled employee to ask whether they are on the way. A confirmation stops escalation. No answer or a confirmed absence starts calls to the pre-approved replacement list, one at a time.
- **Phase 1 — QR/check-in and attendance stats:** QR/check-in records actual arrival. Owner dashboard reports scheduled shifts, attendance confirmation, presence, lateness and an evidence-confidence label based on how each record was obtained. “Confidence” is data quality, never a personal trust/reliability score.
- **Phase 2 — availability and leave planning:** employees submit availability and time-off requests for a planning period; manager reviews constraints and creates/publishes the schedule. “Doodle-like” means collecting availability, not automatically assigning shifts.
- **Phase 3 — fast pay for extra shifts:** after a shift is completed and hours/payroll data are validated, the worker can receive an eligible wage advance or accelerated net-pay transfer. The employer/payroll process remains authoritative; ShiftVoice does not calculate legal payroll. This is not automatically “gross pay instantly at shift end.”
- **Not in current hackathon MVP:** automated T−5 calls, replacement escalation, QR attendance, attendance analytics, schedule generation or leave approval. Keep live demo focused on callout-to-confirmed-replacement.

## Product and hackathon value
- ElevenLabs Conversational AI is the voice interface; Twilio supplies the restaurant phone number and call transport through ElevenLabs' native Twilio integration. Application tools remain on the ShiftVoice API.
- Ingram inference converts speech into a proposed typed intent and concise summaries; application code validates every result.
- Stripe test mode provisions the restaurant SaaS subscription and visibly controls account access.
- The demo measures intake correctness, manager review time, and time to an accepted offer. These are hypotheses, not proven savings.
- Later measures: early delay-notice lead time, late-arrival detection rate, availability response rate, and manager edits needed to publish a schedule.
- Attendance measures: time from T−10 check-in opening to confirmation, no-show escalation rate, verified check-in coverage, lateness distribution and attendance-data confidence mix.
- Phase 3 measures: time from approved payroll amount to worker receipt, payout failure/reversal rate, reconciliation exceptions and fees per payout.

## MVP success
- At least 90% of seeded test callouts resolve to the right employee, shift and action.
- Server-side eligibility matches seeded rules in every acceptance test.
- Manager can authorize outreach in under 30 seconds.
- One acceptance is held pending manager confirmation; no duplicate assignment occurs.
- Demo visibly completes Stripe test checkout, an Ingram structured inference, and an ElevenLabs voice interaction (or a clearly labeled provider-boundary mock).

## Demo assumptions
One restaurant account/location, one manager, seeded employee/shift data, one subscription plan, test phone numbers, and Stripe test mode. External adapters may be mocked after the documented 30-minute setup threshold, while application validation and state transitions remain real.
