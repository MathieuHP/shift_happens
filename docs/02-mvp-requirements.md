# MVP requirements

## Product workflow requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Match caller to an employee using approved phone mapping; otherwise collect employee ID/name and flag for manager review. | Must |
| FR-02 | Use ElevenLabs voice interaction to capture callout vs future time off, shift and confirmation/read-back; disclose automation. | Must |
| FR-02a | Connect the restaurant Twilio number to the ElevenLabs Conversational AI agent for inbound and outbound calls; correlate Twilio `CallSid` and ElevenLabs `conversation_id` with the application interaction. | Must demo |
| FR-03 | Use Ingram inference for typed extraction/ambiguity detection; validate output and ask a clarification when required. | Must |
| FR-04 | Create a pending case only; voice agent cannot approve leave, authorize outreach or assign staff. | Must |
| FR-05 | Show manager case, affected shift, candidate eligibility reasons and warnings. | Must |
| FR-06 | Compute role/skills, availability, active status and rest/overlap eligibility in server code. | Must |
| FR-07 | Require authenticated manager approval before outreach; manager may edit recipients or reject. | Must |
| FR-08 | Contact eligible candidates sequentially; stop on one held acceptance. Voice outbound is preferred; a clearly labeled simulated call/inbox is acceptable fallback. | Must |
| FR-09 | Keep acceptance pending until manager atomically confirms assignment. | Must |
| FR-10 | Audit state changes, offer responses and timestamps; deduplicate retries. | Must |
| FR-11 | Create restaurant account and one Stripe test-mode subscription; process verified webhooks idempotently and derive entitlement from subscription status. | Must demo |
| FR-12 | Block product access when entitlement is inactive without changing shift workflow records. | Must |
| FR-13 | Show subscription status/usage in manager dashboard and provide Stripe Customer Portal when feasible. | Should demo |
| FR-14 | Record future time-off request as pending manager review only. | Should |

## Roadmap requirements (excluded from hackathon MVP)

| ID | Requirement | Phase / priority |
|---|---|---|
| R-01 | Employee reports expected lateness in app with affected shift and optional ETA; manager is alerted. | Phase 1 — Should |
| R-02 | Employee scans a location QR code to record actual arrival time; QR event is distinct from a delay notice. | Phase 1 — Should |
| R-03 | Manager may start the existing approved replacement outreach flow after a delay report; no automatic outreach or schedule reassignment. | Phase 1 — Must for coverage action |
| R-04 | Employee submits availability for a defined planning period and requests time off with dates. | Phase 2 — Must |
| R-05 | System produces a draft schedule from validated availability, role/skill and rest/overlap constraints; manager reviews/edits and publishes. | Phase 2 — Should; manager remains final authority |
| R-06 | Manager approves/rejects time-off requests; approval never occurs solely from inference or availability collection. | Phase 2 — Must |
| R-07 | Show a worker an approved payable amount and initiate an eligible accelerated payout only after attendance, payroll calculation, employer authorization and legal timing checks. | Phase 3 — Must; not hackathon MVP |
| R-08 | Track payout lifecycle and reconcile provider outcome to payroll reference; retries cannot pay twice. | Phase 3 — Must |
| R-09 | Open employee check-in at T−10; if no delay notice/check-in by T−5, call scheduled employee and ask whether they are on the way. | Phase 1 — Must |
| R-10 | If employee confirms they are on the way or reports a valid ETA, stop escalation; if no answer or employee confirms absence, start sequential calls to manager-preapproved eligible replacements. | Phase 1 — Must, requires restaurant opt-in |
| R-11 | Allow advance in-app delay notice; it suppresses the automated check-in call and alerts manager with employee-reported ETA. | Phase 1 — Must |
| R-12 | Provide owner attendance dashboard for scheduled shift times/duration, attendance confirmation, presence and lateness, with evidence confidence based on record source. | Phase 1 — Should |

Attendance dashboard definitions (Phase 1): show published scheduled shift start/end and duration; `checked in` = valid check-in event; `attendance confirmed` = manager-confirmed attendance (or a later explicit end-of-shift workflow, if added). Do not label check-in alone as a completed/worked shift. `late` = first valid check-in later than shift start plus the configured grace period; `minutes late` = check-in timestamp minus scheduled start, floored at zero. Show no-response/absence-confirmed separately from checked-in and from payroll hours. `Evidence confidence` describes source quality: high = validated QR/app check-in; medium = employee self-report or manager correction; low/unknown = unresolved/no evidence. The exact source labels are visible; this is not employee reputation.

QR scans, delay reports, availability and requests must not silently mutate published shifts. Scheduling is a later bounded module, not part of callout MVP.

## Automated lateness escalation policy (Phase 1)
`T_checkin = shift_start − 10 minutes`; `T_call = T_checkin + 5 minutes = shift_start − 5 minutes`. A prior delay notice or valid check-in suppresses the employee call. Employee confirmation they are on the way stops calls to replacements. One unanswered employee call or explicit absence starts the sequential pre-approved eligible list only when restaurant automation is enabled and the manager has authorized that policy. Each replacement acceptance remains `accepted_pending_manager`; final assignment still requires manager confirmation. No eligible/available replacement or exhausted list alerts the manager.

## Wage payment boundary (Phase 3)
Stripe Billing remains for the restaurant SaaS subscription. Worker payouts, if supported, are a separate Stripe Connect or other approved payout integration (**TO VERIFY**). A payroll provider/payroll clerk must supply the validated gross/net amounts, deductions and payroll reference. The application may trigger an accelerated transfer only when permitted by the employer's payroll process, the applicable sector/contract rules and provider eligibility. Do not treat QR data as payable hours without manager/payroll approval. Never market “instant salary” until bank arrival timing, fees, eligibility and Belgian legal treatment are confirmed. No payout in the hackathon MVP; use a labeled test-mode/mock ledger only.

## Inference contract
Every operation follows `input → Ingram inference → schema-checked structured output → deterministic validation → application action`. Inference may extract/classify/clarify/summarize. It never decides eligibility, permissions, state transitions, idempotency, final candidate selection or assignment. Confidence thresholds and available Ingram tool/model identifiers are **TO VERIFY**; low confidence always asks a question or routes to manager review.

## Non-functional and privacy requirements
- Do not request diagnosis or detailed medical reasons. Do not retain raw audio/transcripts by default.
- Store only minimal structured extraction, confidence, provider trace ID and short-lived operational note if enabled and consented.
- Manager actions require authentication; secrets remain server-side; verify provider webhook signatures where supported (**TO VERIFY** per endpoint).
- State-changing calls are idempotent and auditable. Use seeded demo data and test numbers only.
- If speech is unclear twice, offer human transfer/callback or create a manager review case.
- Keep Twilio and ElevenLabs credentials server-side/configured through the supported integration; validate signatures on application webhooks where supported. Exact security mechanism is **TO VERIFY** in provisioned setup.

## Subscription entitlement
Single restaurant account and plan in test mode. `trialing` and `active` grant access; `past_due` follows a configurable demo grace period (default: no new voice intake, dashboard read-only); `canceled` denies new workflow actions. Entitlement is checked by application middleware. Existing cases/offers remain readable and are never rewritten by billing events.

## Explicit policy defaults
Candidate order is deterministic: role/skills match, full-shift availability, least recent offer, stable tie-break. Never rank using attendance, discipline, protected traits or inferred reliability. No auto-assignment. A voice acceptance means “pending manager confirmation.”
