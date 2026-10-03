# Feature ladder and requirements

Build one feature at a time. Each feature is demoable alone, has a definition of done (acceptance in `03-user-stories.md`), and states what is real vs mocked. Do not start a feature before the previous one is done.

| # | Feature | Real | Mocked at this step | Priority |
|---|---|---|---|---|
| F0 | Foundations: seed data, DB, audit log, idempotency helper, provider adapter interfaces + mock adapters | all | voice, billing | Must |
| F1 | Case lifecycle + manager dashboard (case created via dashboard form) | state machine, audit, auth | caller input | Must |
| F2 | Deterministic eligibility with rule reasons | all | – | Must |
| F3 | Approval → sequential offers → held acceptance → atomic confirmation | all logic | outbound call = demo inbox | Must |
| F4 | Urgency: case deadline, manager notification, reminder | logic | notification channel may be a stub | Must |
| F5 | Inbound voice intake (ElevenLabs + Twilio) creating a pending case | voice, tools, validation | – | Must demo |
| F6 | Stripe test checkout + webhook + entitlement gating | all | webhook transport may be signed fixture | Must demo |
| F7 | Outbound voice offers (ElevenLabs Twilio outbound call) | calls | – | Should demo |
| F8 | Time-off request recorded as pending only | all | – | Should |
| F9 | Customer Portal link + subscription/usage panel | all | – | Could |

Rationale for the order: F0–F4 give a complete, honest end-to-end loop without any provider. F5–F7 then replace mocks one provider at a time, so a provider failure never blocks the loop. Voice (F5) comes before Stripe because voice is the product.

## Functional requirements

| ID | Feature | Requirement |
|---|---|---|
| FR-01 | F1/F5 | Match caller to an employee by approved phone mapping; otherwise collect employee ID/name and flag the case unverified for manager review. |
| FR-02 | F5 | Voice agent discloses automation, captures callout vs time-off and the shift, reads details back and accepts correction. |
| FR-03 | F5 | Agent tool arguments (employee, shift ID, type) are validated server-side: the shift must belong to the verified employee and be upcoming. The server never accepts a model-supplied identity. |
| FR-04 | F1/F5 | Creating a case never approves leave, authorizes outreach or assigns anyone. |
| FR-05 | F1 | Manager sees case, shift, deadline, candidate list with eligibility reasons and warnings; summary is template-generated from fields (no LLM). |
| FR-06 | F2 | Eligibility computed by server code only (rules below). |
| FR-07 | F3 | Authenticated manager approval before any outreach; manager may edit recipients or reject. |
| FR-08 | F3/F7 | Candidates contacted strictly one at a time; each offer has a timeout; stop at first held acceptance. Fallback to a labeled demo inbox. |
| FR-09 | F3 | Acceptance stays `accepted_pending_manager` until the manager confirms; confirmation is atomic and single-winner. |
| FR-10 | F0 | Every state change, offer response and provider event is audited and deduplicated. |
| FR-11 | F4 | Every case has a deadline (shift start). Manager is notified on case creation and reminded if unapproved after a configured delay (demo default 2 min). Cases past deadline are flagged, never silently dropped. |
| FR-12 | F6 | Create account + Stripe test subscription; verified, idempotent webhooks; entitlement derived from persisted subscription state. |
| FR-13 | F6 | Entitlement is binary: `trialing`/`active` → enabled; anything else → disabled (no new intake or outreach; existing data readable). Checkout redirect alone grants nothing. |
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
- Caller ID is a convenience match, not authentication. Anything unmatched is flagged unverified; no outreach happens without manager approval anyway.
- Manager endpoints require an authenticated session; provider secrets stay server-side; verify webhook signatures where supported.
- Mutating calls are idempotent. Demo uses seeded data and test numbers only.
- Speech unclear twice → offer callback or create a manager-review case.
