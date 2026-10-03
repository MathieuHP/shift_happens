# Feature ladder and requirements

Build one feature at a time. Each feature is demoable alone, has a definition of done (acceptance in `03-user-stories.md`), and states what is real vs mocked. Do not start a feature before the previous one is done.

| # | Feature | Real | Mocked at this step | Priority |
|---|---|---|---|---|
| F0 | Foundations: seed data, DB, audit log, idempotency helper, provider adapter interfaces + mock adapters | all | voice, billing | Must |
| F1 | Attendance-recovery case lifecycle + manager dashboard | state machine, audit, auth | scanner/attendance event input | Must |
| F2 | Deterministic eligibility with rule reasons | all | – | Must |
| F3 | Sequential replacement offers → held acceptance → assignment/confirmation | all logic | outbound call = demo inbox | Must |
| F4 | Urgency: case deadline, manager notification, reminder | logic | notification channel may be a stub | Must |
| F5 | Outbound attendance check + replacement cascade (ElevenLabs + Twilio) | QR validation, timing, calls, responses | provider transport may be mocked | Must demo |
| F6 | Stripe test checkout + webhook + entitlement gating | all | webhook transport may be signed fixture | Must demo |
| F7 | Absorbed into F5: outbound voice offers | – | – | – |
| F8 | Time-off request recorded as pending only | all | – | Should |
| F9 | Customer Portal link + subscription/usage panel | all | – | Could |

Rationale for the order: F0–F4 give a complete, honest end-to-end loop without a live provider. F5 then replaces the outbound-call mock with real attendance checks and replacement calls, so provider failure never changes the domain loop. Voice remains the operational product surface, but employees do not call inbound.

## Functional requirements

| ID | Feature | Requirement |
|---|---|---|
| FR-01 | F1/F5 | A check-in token is bound to exactly one employee and shift; the venue/manager scanner rejects wrong, expired, reused, or invalid tokens. |
| FR-02 | F5 | Check-in opens at `T−10`; at `T−5`, no valid check-in and no late declaration starts exactly one attendance-recovery workflow. |
| FR-03 | F5 | The system calls the scheduled employee once and classifies only `on_my_way`, `absent`, `no_answer`, or `unclear`; no response is inferred beyond those outcomes. |
| FR-04 | F1/F5 | `on_my_way` stops the cascade; `absent`, `no_answer`, or `unclear` starts sequential calls to eligible replacements. |
| FR-05 | F1/F5 | Replacement assignment mode is manager-configurable: automatic first acceptance or held acceptance requiring manager confirmation. |
| FR-06 | F1 | Manager sees attendance status, shift, deadline, candidate list with eligibility reasons and warnings; summary is template-generated from fields (no LLM). |
| FR-07 | F2 | Eligibility computed by server code only (rules below). |
| FR-08 | F3 | Replacement candidates are contacted strictly one at a time; each offer has a timeout; stop at first acceptance. Fallback to a labeled demo inbox. |
| FR-09 | F3 | Manual mode keeps acceptance in `accepted_pending_manager`; confirmation is atomic and single-winner. Automatic mode assigns the first valid acceptance atomically. |
| FR-10 | F0 | Every state change, check-in, call response and provider event is audited and deduplicated. |
| FR-11 | F4 | Every recovery case has a deadline (shift start). Manager is notified on creation and reminded if unresolved after a configured delay. Cases past deadline are flagged, never silently dropped. |
| FR-12 | F6 | Create account + Stripe test subscription; verified, idempotent webhooks; entitlement derived from persisted subscription state. |
| FR-13 | F6 | Entitlement is binary: `trialing`/`active` → enabled; anything else → disabled (no new attendance recovery or outreach; existing data readable). Checkout redirect alone grants nothing. |
| FR-14 | F9 | Subscription status and Customer Portal link on dashboard. |
| FR-15 | F8 | Future time-off request stored as pending only. |

## Eligibility rules (seeded demo, F2)
A candidate is eligible only if all hold:
1. `active` and not the absent employee.
2. Role matches the shift role and has all `required_skills`.
3. Availability fully covers the shift interval.
4. No overlap with another assigned shift.
5. Rest between shifts ≥ configured minimum (default 11 h; placeholder, to validate against local rules).
6. `contact_consent_at` set and "now" inside the configured contact window.

Order: least recent offer first, then stable tie-break by employee ID. Never rank using attendance, discipline, protected traits or inferred reliability. Each rule outcome is stored as a reason code and shown to the manager.

## Non-functional and privacy
- Do not ask for a medical reason; do not persist raw audio or transcripts. The ElevenLabs agent runs with recording and transcript retention disabled; provider-side retention to be confirmed in the spike (`09-open-decisions.md`).
- QR tokens are signed, employee/shift-bound, time-limited and single-use. A scan is attendance evidence for operations, not proof of worked hours or payroll.
- Manager endpoints require an authenticated session; provider secrets stay server-side; verify webhook signatures where supported.
- Mutating calls are idempotent. Demo uses seeded data and test numbers only.
- An unclear attendance response does not infer intent; it starts the configured fallback path and alerts the manager.
