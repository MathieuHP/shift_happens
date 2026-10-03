> **Note (2026-10-03):** the hackathon build is in-app only (no SMS/voice). Twilio/ElevenLabs components below are post-hackathon. See the decision log in `09-open-decisions.md`.

# Architecture

## Components
- **Attendance:** employee app displays a signed QR token for each shift; a venue/manager scanner submits it for server validation.
- **Phone:** for replacement offers, the backend calls the **ElevenLabs Conversational AI** Twilio outbound-call API. There is no employee-initiated inbound call path. This repository still contains legacy Twilio SMS/voice routes awaiting the cleanup approval described below.
- **ElevenLabs agent:** one outbound agent handles scheduled-employee attendance checks and candidate offers. Recording and transcript/audio retention off. It can only use the allowlisted response tools below.
- **Application API:** narrow authenticated tools; all of them go through domain services.
- **Domain services:** `CaseService`, `ShiftService`, deterministic `EligibilityService`, `OfferService`, `NotificationService`, `EntitlementService`, `AuditService`.
- **Adapters (interfaces with real + mock implementations):** `VoiceProvider` (ElevenLabs or clearly labeled simulated provider), `BillingProvider` (Stripe vs signed fixture), `Notifier` (stub vs real channel).
- **DB:** SQLite/Postgres. **Manager dashboard:** attendance, recovery cases, offers, assignment mode, confirmation, urgency, account status.
- **Billing Service:** Checkout, webhook reconciliation, optional Customer Portal; separate tables and handlers from shift operations.
- **No inference service.** There is no LLM in the application path. Manager summaries are templates over structured fields. If a future feature needs one it enters as a new adapter with the same rule: schema-checked output, no authority.

## Data flows
`Employee app → signed QR → venue scanner → Application API → validation → AttendanceService → DB → dashboard`

`Scheduler/AttendanceService → ElevenLabs Twilio outbound-call API → Twilio → scheduled employee or candidate → scoped response tool → Application API → Recovery/OfferService`

`callNextCandidate → persisted CallAttempt → VoiceProvider → ElevenLabs POST /v1/convai/twilio/outbound-call → Twilio → candidate → POST /api/voice/respond`

The agent receives shift and compensation values as `conversation_initiation_client_data.dynamic_variables`. The API key and call recipient remain server-side. The conversation ID is matched against the stored attempt; the agent never supplies an attempt, employee, or shift identifier.

`Stripe ↔ Billing Service ↔ Subscription/entitlement` (never touches cases)

MCP, if used, only mirrors these narrow tools and cannot bypass domain services or manager permissions.

## Tool boundaries

| Capability | Caller | Validation | Mutation / errors |
|---|---|---|---|
| `attendance.record_check_in` | venue/manager scanner | signed token, employee/shift binding, time window, single-use key | records check-in; `invalid_token`, `wrong_shift`, `duplicate` |
| `attendance.declare_late` | employee session | assigned employee, shift, before recovery trigger | records late declaration; `not_assigned`, `too_late`, `duplicate` |
| `voice.submit_attendance_response` | outbound agent | call bound to scheduled employee and recovery case | records `on_my_way|absent|no_answer|unclear`; `expired`, `closed`, `wrong_employee`, `duplicate` |
| `voice.submit_offer_response` | outbound agent | offer bound to this call/candidate, offer open | records yes/no once; `expired`, `closed`, `wrong_candidate`, `duplicate` |
| `manager.authorize_outreach` | manager session | recompute eligibility, state check, idempotency | → `offering`; `forbidden`, `ineligible`, `invalid_state` |
| `manager.confirm_replacement` | manager session | transactional compare-and-set | → `filled`; `already_filled`, `offer_not_accepted`, `conflict` |
| `stripe.checkout.create` | manager session | server-side price allowlist | external session; idempotent |
| `stripe.webhook.subscription` | Stripe | signature, event dedupe, reconcile | billing tables only; `invalid_signature`, `duplicate`, `out_of_order` |
| `billing.create_portal_session` | manager session | ownership | external session |
| `recovery.start` | scheduler/domain service | `T−5`, no valid check-in/late declaration, entitlement, idempotency | creates one recovery case; `already_checked_in`, `already_started`, `duplicate` |
| ElevenLabs `POST /v1/convai/twilio/outbound-call` | backend only | verified active workflow, recipient, consent, contact window; API key never exposed | persist `CallAttempt` + idempotency key before sending; failure ≠ delivered call |
| `POST /api/voice/respond` | ElevenLabs tool | `x-voice-secret`, `x-conversation-id`, yes/no schema; conversation ID maps to one stored attempt | `respond_to_voice_offer` transaction returns accepted, pending approval, declined, or ignored |
| `POST /api/voice/status` | ElevenLabs signed webhook | HMAC signature, 30-minute timestamp tolerance, conversation ID lookup | only call-initiation failure events update attempts; no transcript/audio payload is retained |
| `POST /api/voice/advance` | scheduler | `x-voice-secret`; expires only attempts with a known conversation ID | marks no answer and starts the next candidate; unknown network outcomes remain parked to prevent duplicate calls |

Only scoped `voice.*` response tools are callable by the agent. The agent never sees recipient selection, eligibility computation, assignment mode, manager confirmation, or billing operations.

## Reliability
Persist provider IDs and idempotency keys. Offer acceptance and assignment use a PostgreSQL row-locking transaction. The ElevenLabs endpoint does not accept a documented idempotency key; a network timeout before a conversation ID is returned leaves the attempt active and prevents automatic redial pending reconciliation.

## Provider references
[Native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration), [outbound call](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call), [phone number list](https://elevenlabs.io/docs/api-reference/phone-numbers/list), [call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks), [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables). The phone resource ID is resolved server-side from the assigned agent and E.164 number when not configured explicitly.
