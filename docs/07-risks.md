# Privacy, safety and operational risks

| Risk | MVP mitigation |
|---|---|
| Wrong caller or shift | Verify phone/employee mapping; read back; ambiguous/unmatched cases require manager review. |
| Voice hallucination or misunderstanding | Agent can only speak from validated tool results; read-back confirmation; no promise of approval/coverage; unclear twice → human/callback. |
| Ingram returns invalid structured data | Strict schema/enum validation, bounded retry, confidence threshold **TO VERIFY**, safe clarification/manager review; no domain action on invalid output. |
| Prompt injection in employee speech | Treat transcript as untrusted data, not instructions; fixed system policy and allowlisted tools; server-side authorization for every call. |
| Voice-agent tool overreach | Narrow tools omit approval/assignment operations; manager endpoints require separate authenticated session and role; verify actor server-side. |
| Inference changes eligibility | Eligibility is exclusively deterministic server code; model receives no authority; regression test compares outputs across altered model output. |
| Wrong/ineligible replacement contacted | Server filters role, skills, availability, active status, rest/overlap; manager authorizes; show rule reasons. |
| Two people assigned to one shift | Transactional single-winner confirmation, compare-and-set, close remaining offers. |
| Sensitive transcript/medical detail stored | Do not ask reason; no raw transcript/audio persistence by default; minimize/redact unsolicited content; short note only with configured consent. |
| ElevenLabs outage | Manual dashboard intake/contact checklist; preserve case; mock voice boundary for demo. |
| Twilio phone number is misrouted, unavailable, or calls fail | Verify inbound and outbound test calls to approved test numbers before demo; monitor call status; retain interaction/case and alert manager; use manual fallback. |
| Wrong caller ID or provider call linked to the wrong shift | Correlate Twilio `CallSid`, ElevenLabs `conversation_id`, configured agent/number and server-side shift/candidate context; reject unknown or mismatched calls. |
| Outbound call API retry creates duplicate calls | Persist `CallAttempt` and internal idempotency key before request; on timeout reconcile by returned IDs/status before retry; only one active call attempt per workflow. |
| Ingram outage | Deterministic slot-based/manual intake fallback; preserve pending case; mock inference with same schema for demo. |
| Stripe duplicate/replayed webhook | Verify signature, unique provider event ID, idempotent handler, reconcile authoritative subscription state; replay tests. |
| Incorrect subscription entitlement | Entitlement service uses persisted subscription state, not browser redirect; deny/limit safely while pending; billing isolated from shift state; audit changes. |
| Stripe outage or delayed webhook | Show activation pending; do not grant access based on checkout redirect alone; demo may use signed fixture/mock webhook clearly labeled. |
| Outbound consent/contact-hours breach | Check employee consent and configured contact window before dialing; test numbers only; use mock if not verified. |
| Provider webhook duplicate or spoof | Verify signatures where supported, dedupe IDs, validate event ownership and payload schema; unsupported verification is **TO VERIFY** and mocked until resolved. |
| Provider outage leaves shift uncovered | Keep case open, show manual fallback and manager action; never claim coverage. |
| Unfair automated work decisions | No attendance, discipline, protected trait or inferred reliability ranking; optional inference prioritization is out of MVP. |
| Labor/privacy law differs by region | No legal compliance claim; production requires local review and configured rules. Recording off pending review. |
| Static QR is copied/shared or scanned remotely | Use signed/rotating short-lived codes where feasible; server-side shift/location window and replay dedupe; **TO VERIFY** before launch. Do not claim QR alone proves work performed. |
| QR timestamp is mistaken for payroll-grade timekeeping | Label as operational check-in only; define correction process and retention; do not calculate wages in the prototype. |
| Employee reports delay for wrong shift or inaccurate ETA | Authenticate employee, match to assigned shift, mark ETA as employee-reported, and let manager decide any follow-up. |
| Late alert creates unfair automatic discipline | Alert manager only; no penalty, opaque attendance score, or disciplinary recommendation. Make configured grace threshold visible and auditable; distinguish confirmed absence from no response. |
| T−5 call or replacement escalation is triggered incorrectly | Server derives exact times from shift start; suppress on delay notice/check-in; idempotent scheduler; make one employee call; validate response; manager can disable policy and receives audit/alert. |
| Automatic replacement outreach violates employee expectations or contacts people at a bad time | Disabled by default; owner/manager explicitly authorizes the policy and pre-approves recipients, contact window and sequence; contact consent checked; stop on response/acceptance; manager confirms assignment. |
| Employee says “on my way” but does not arrive | Record as self-report with ETA; do not label present; retain manager dashboard visibility and check-in status; manager can resume coverage escalation if ETA is missed. |
| Analytics “confidence” becomes a worker reliability score | Define it only as attendance evidence provenance/confidence; no composite individual score, prediction, ranking or disciplinary recommendation. Explain source labels and allow corrections. |
| Presence statistics expose or misrepresent employee behavior | Restrict to authorized restaurant owner/manager; show counts, denominators and source coverage; avoid small-cohort inference/sharing; retention and employee notice reviewed before pilot. |
| Presence tracking or automated calling is deployed without appropriate workforce notice/assessment | Require documented purpose, employee notice, access/retention controls and Belgian data-protection/workplace-monitoring review before pilot; collect only shift-specific records. |
| Availability or leave data is incomplete/stale | Show missing submissions and timestamps; drafts flag uncovered/uncertain slots; manager reviews before publication. |
| Auto-generated schedule violates rest, skills or local work rules | Hard constraints computed by application code; unresolved conflicts prevent publication; local rules require review/configuration. |
| Draft is mistaken for published schedule | Separate draft/published views and status; explicit manager publish action with audit event and employee notification. |
| Wage amount calculated from QR scan or AI estimate | Require payroll-originated validated hours and gross/net amount plus manager/payroll authorization; QR is attendance evidence only, not wage calculation. |
| Accelerated payout violates wage timing/contract/sector rules | Validate Belgian rules and applicable sector/contract with payroll/legal specialist per pilot; configurable payroll approval gate; do not enable real payouts until cleared. |
| Stripe payout described as instant but settles later | Show provider-confirmed status and estimated arrival; never promise instant availability; verify Belgium account eligibility, bank rails, fees and settlement timing. |
| Wrong worker or payout destination | Delegate account/KYC onboarding to approved provider flow; verify worker-payable linkage; never accept bank details via voice; require manager/payroll authorization. |
| Duplicate payment on retry/webhook replay | Unique payroll reference/payable ID, idempotency key and provider event dedupe; reconcile before retry; payout state machine. |
| Payroll amount or deductions are incomplete | ShiftVoice does not compute payroll; use payroll adapter and treat missing/changed values as blocked for payout; preserve normal payroll payment fallback. |
| Worker pressured into fee-bearing early pay | Explicit optional opt-in, transparent fee/timing, no default enrollment or penalty; terms reviewed before pilot. |

## Human control
Manager approval is mandatory before outreach and manager confirmation before assignment. Voice and inference cannot approve leave, discipline, or alter schedule assignment.

## Demo safeguards
Fictional roster and test numbers; Stripe test mode only; no real employee contact or raw transcript retention. Label mocks clearly and keep real internal validations/state transitions active.
