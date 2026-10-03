# Architecture

## Components
- **Phone:** Twilio number connected to **ElevenLabs Conversational AI** (native integration) for inbound and outbound calls. Inbound: Twilio → ElevenLabs. Outbound: the backend calls ElevenLabs' Twilio outbound-call API.
- **ElevenLabs agent:** one agent with employee-callout and candidate-offer branches. Recording and transcript/audio retention off. It can only use the allowlisted webhook tools below.
- **Application API:** narrow authenticated tools; all of them go through domain services.
- **Domain services:** `CaseService`, `ShiftService`, deterministic `EligibilityService`, `OfferService`, `NotificationService`, `EntitlementService`, `AuditService`.
- **Adapters (interfaces with real + mock implementations):** `VoiceProvider` (ElevenLabs/Twilio vs demo inbox), `BillingProvider` (Stripe vs signed fixture), `Notifier` (stub vs real channel).
- **DB:** SQLite/Postgres. **Manager dashboard:** cases, approval, offers, confirmation, urgency, account status.
- **Billing Service:** Checkout, webhook reconciliation, optional Customer Portal; separate tables and handlers from shift operations.
- **No inference service.** There is no LLM in the application path. Manager summaries are templates over structured fields. If a future feature needs one it enters as a new adapter with the same rule: schema-checked output, no authority.

## Data flows
`Phone → ElevenLabs agent → webhook tool → Application API → validation → domain service → DB → dashboard`

`Application API → ElevenLabs Twilio outbound-call API → Twilio → candidate → ElevenLabs agent → scoped response tool → Application API → OfferService`

`Stripe ↔ Billing Service ↔ Subscription/entitlement` (never touches cases)

MCP, if used, only mirrors these narrow tools and cannot bypass domain services or manager permissions.

## Tool boundaries

| Capability | Caller | Validation | Mutation / errors |
|---|---|---|---|
| `voice.record_inbound_call_context` | trusted integration | configured number/agent; signature where available | creates/updates `VoiceInteraction`; unique provider IDs; `unknown_number`, `duplicate` |
| `voice.lookup_employee` | agent | normalize phone; never trust supplied identity | none; `not_found`, `ambiguous` |
| `voice.list_upcoming_shifts` | agent | employee scope, bounded range | none |
| `voice.create_pending_callout` | agent | verified employee, shift ∈ employee's upcoming shifts, type enum, entitlement, idempotency key | creates case; `ambiguous_shift`, `entitlement_inactive`, `duplicate` |
| `voice.submit_offer_response` | outbound agent | offer bound to this call/candidate, offer open | records yes/no once; `expired`, `closed`, `wrong_candidate`, `duplicate` |
| `manager.authorize_outreach` | manager session | recompute eligibility, state check, idempotency | → `offering`; `forbidden`, `ineligible`, `invalid_state` |
| `manager.confirm_replacement` | manager session | transactional compare-and-set | → `filled`; `already_filled`, `offer_not_accepted`, `conflict` |
| `stripe.checkout.create` | manager session | server-side price allowlist | external session; idempotent |
| `stripe.webhook.subscription` | Stripe | signature, event dedupe, reconcile | billing tables only; `invalid_signature`, `duplicate`, `out_of_order` |
| `billing.create_portal_session` | manager session | ownership | external session |
| ElevenLabs `POST /v1/convai/twilio/outbound-call` | backend only | verified active workflow, recipient, consent, contact window; API key never exposed | persist `CallAttempt` + idempotency key before sending; failure ≠ delivered call |

Only `voice.*` tools are callable by the agent. The agent never sees approval, assignment, recipient selection or billing operations.

## Reliability
Persist provider event IDs and idempotency keys. Offer acceptance and confirmation use transactional compare-and-set. Billing events update subscription only. Provider timeout preserves the case and surfaces a manual action.

## Provider references
[Native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration), [outbound call](https://elevenlabs.io/docs/eleven-agents/api-reference/integrations/twilio/outbound-call), [webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools). Account setup, agent-to-webhook authentication and provider-side retention are verified in the spikes (`09-open-decisions.md`).
