# Technical architecture

## Components
- **Phone:** Twilio number connected to **ElevenLabs Conversational AI** using the native Twilio integration for inbound and outbound voice. Inbound calls route Twilio → ElevenLabs; backend initiates each outbound call through ElevenLabs' Twilio outbound-call API. Confirm number/account provisioning and regional availability: **TO VERIFY**.
- **ElevenLabs setup:** connect/import the Twilio phone number to the intended agent; configure one Conversational AI agent for employee and replacement call branches. Disable call recording and post-call audio/transcript webhooks by default; retain only call status/IDs and minimum validated outcomes.
- **Application API** exposes narrow, authenticated tools; all tools route through domain services.
- **Ingram Inference Adapter** performs speech intent extraction, ambiguity detection and manager summary with strict structured outputs. Exact SDK/tool names, schema mode and model IDs: **TO VERIFY**.
- Domain services: `CalloutService`, `ShiftService`, deterministic `EligibilityService`, `OfferService`, `EntitlementService`, `AuditService`.
- Database: SQLite/Postgres for demo.
- Manager dashboard: review, approval, offer progress, final confirmation, account status and usage.
- Stripe Billing Service: Checkout/session creation, webhook reconciliation, optional Customer Portal. Separate tables and event handling from shifts.
- Schedule adapter is seeded/mock; notifications/outbound offer delivery can be a demo inbox if provider wiring exceeds 30 minutes.
- Roadmap only: `AttendanceService` handles delay notices, T−5 calls and QR check-ins; `PlanningService` collects availability, builds unpublished drafts and records manager publication. Keep these out of the hackathon build.
- Later phase only: `PayrollAdapter` imports validated pay amounts/references from an employer's payroll process; `PayoutService` handles worker consent, authorization, payout status and reconciliation. Do not implement payroll calculation in ShiftVoice.

## Architecture and data flow
`Phone → ElevenLabs Voice Agent → Application API / narrow tools → Ingram inference → schema validation → deterministic domain services → database → manager dashboard`

Separate flows:
`Stripe ↔ Billing Service ↔ RestaurantAccount entitlement`

`Application API → ElevenLabs Twilio outbound-call API → Twilio → employee/replacement → ElevenLabs agent webhook tool → application API → domain service`

Roadmap flows:
`Employee app / QR → AttendanceService → T−5 check → ElevenLabs Twilio outbound-call API → Twilio → scheduled employee → (preauthorized) sequential candidate calls → manager dashboard`

`AttendanceService → owner attendance dashboard (counts, lateness, source confidence)`

`Employee availability / time-off → PlanningService → deterministic schedule draft → manager edits and publishes`

`Attendance + payroll provider → validated payable net amount → manager/payroll authorization → PayoutService ↔ Stripe Connect (TO VERIFY) → employee bank account`

MCP may expose the same narrow application capabilities to an MCP-capable orchestrator. MCP never calls the database directly and cannot bypass domain services or manager permissions.

## Inference operations

| Operation | Input → inference → structured output | Validation → application action |
|---|---|---|
| Intake extraction | Minimal transcript + locale + allowed shift context → extract → `{intent: callout\|time_off, date_expression, shift_reference, optional_note, confidence, ambiguities[]}` | JSON/schema, enum, note length/sensitivity and confidence checks → ask clarification or pass proposal to `CalloutService`; application resolves actual shift. |
| Conversation branch | Validated conversation facts → classify next step → `{branch: identify\|select_shift\|clarify\|confirm\|handoff}` | Allowlisted branch and required slots check → voice agent asks approved prompt. |
| Manager summary | Case/shift/eligibility facts without raw transcript → summarize → `{summary, unresolved_items[]}` | Length and factual-field checks → display as labeled summary; facts link to source fields. |
| Candidate prioritization (optional/post-hackathon) | Allowed operational facts only → preference score/order suggestion → `{candidate_ids[], rationale_codes[]}` | Reject IDs outside eligible set; deterministic eligibility and tie-break remain authoritative. No sensitive/protected data. Do not build for MVP. |

Availability parsing, QR timestamps, lateness thresholds, schedule constraints and leave decisions are deterministic application operations. An inference model may summarize a draft or flag ambiguous employee-entered text, but cannot mark attendance, decide leave, choose assignments, or publish a schedule.

Inbound calls route from the Twilio restaurant number to ElevenLabs Conversational AI through the native Twilio integration. ElevenLabs webhook tools call narrow ShiftVoice application APIs. Bind the inbound Twilio `CallSid` and ElevenLabs `conversation_id` to `VoiceInteraction` after validating call context and caller. For outbound calls, the application server calls ElevenLabs' Twilio outbound-call API and stores its returned `conversation_id` and `callSid`. The backend, not the voice agent, selects recipients and starts each sequential call. The agent submits a scoped response tool call; application code validates intent and state. Unclear responses get one clarification then follow the no-response path. Automated candidate contact requires a stored restaurant policy and manager authorization established in advance; voice agent cannot change that setting. Analytics `confidence` labels evidence source quality only and never represents employee trustworthiness.

For every inference call retain only operation, provider trace ID, schema version, confidence and validation outcome; raw transcripts/audio are not persisted by default.

## Tool boundaries
The ElevenLabs outbound API path below is documented by the provider. Account setup, credentials, callback security and provisioned Twilio number remain **TO VERIFY**. Remaining names are internal contracts.

| Callable capability | Purpose / inputs → outputs | Caller & validation | Mutation / idempotency / errors |
|---|---|---|---|
| `voice.lookup_employee` | caller phone or employee ID → verified employee/minimal match | ElevenLabs agent via server-authenticated adapter; normalize phone; never trust supplied identity | No mutation; `not_found`, `ambiguous`, `unauthorized` |
| `voice.list_upcoming_shifts` | verified employee ID, date range → candidate shifts | Agent; employee scope enforced; range bounded | No mutation; `not_found`, `forbidden` |
| `voice.create_pending_callout` | verified employee, selected shift, type, validated short note?, interaction ID → case/reference/status | Agent; domain checks identity/shift/type/account entitlement; cannot set approval or assignment | Mutates; idempotency key required; `ambiguous_shift`, `invalid_state`, `entitlement_inactive`, `duplicate` |
| `voice.submit_offer_response` | offer ID, yes/no, provider call ID → response/status | Outbound agent; candidate-to-offer binding, open offer and consent checked server-side | Mutates; provider event/call ID dedupe; `expired`, `closed`, `wrong_candidate`, `duplicate` |
| `voice.record_inbound_call_context` | Twilio caller/called number, `CallSid`, ElevenLabs `conversation_id` → scoped interaction context | Trusted integration path only; verify configured Twilio number/agent and provider signature/auth where available (**TO VERIFY**) | Creates/updates VoiceInteraction; unique provider IDs; `unknown_number`, `invalid_context`, `duplicate` |
| `inference.extract_callout` | minimum text/context → schema result + trace ID | Internal inference adapter only; schema/confidence/privacy validation | No domain mutation; timeout, malformed output, low confidence |
| `inference.summarize_case` | structured case facts → concise summary | Internal service; no raw transcript, factual output validation | No mutation; timeout/malformed output |
| `mcp.*` mirrors | Optional mirror of approved application tools | Authenticated MCP caller; same scopes, validation and domain services as API | Same mutation/idempotency/errors as target operation |
| `stripe.checkout.create` | restaurant account + configured plan → checkout URL/session ref | Manager session; account/plan allowlist and server-side price ID | Creates external session; idempotency key; provider failure |
| `stripe.webhook.subscription` | signed raw event → accepted/ignored result | Stripe webhook only; signature verification and event dedupe; reconcile supported event shapes (**TO VERIFY**) | Mutates billing records only; event-ID uniqueness; invalid signature/duplicate/out-of-order |
| `billing.create_portal_session` | account → portal URL | Authenticated account manager; ownership check | External session creation; idempotent where supported; provider failure |
| `manager.authorize_outreach` | case + selected candidate IDs → offering | Authenticated manager only; recompute eligibility and state | Mutates; idempotency key; `forbidden`, `ineligible`, `invalid_state` |
| `manager.confirm_replacement` | case + accepted offer → filled | Authenticated manager only; transactional compare-and-set | Mutates; idempotency key; `already_filled`, `offer_not_accepted`, `conflict` |
| ElevenLabs `POST /v1/convai/twilio/outbound-call` | `agent_id`, `agent_phone_number_id`, `to_number`, optional conversation initiation client data → `{success, conversation_id, callSid}` | ShiftVoice backend only; before request verify active authorized workflow, recipient, consent and contact window. Never expose API key to agent/client. | Initiates external call; ShiftVoice persists an internal idempotency key and call-attempt row before sending; 422/network/telephony failure is not treated as a delivered call. |
| ElevenLabs webhook tool → ShiftVoice API | Narrow application operation defined by the active agent tool schema → validated application response | ElevenLabs agent; endpoint authenticates provider request and derives employee/offer scope from server-side call context, not model claims (**auth mechanism TO VERIFY**) | Mutates only through documented domain operation; request idempotency key/call ID required; `unauthorized`, `invalid_scope`, `duplicate`, `timeout` |

### Roadmap-only tools (not callable by voice agent)

| Tool | Purpose / inputs → outputs | Caller & validation | Mutation / idempotency / errors |
|---|---|---|---|
| `employee.report_delay` | shift ID + optional ETA → notice reference | Authenticated employee; shift belongs to employee; ETA bounded | Mutates attendance context; idempotent per employee/shift/notice key; `wrong_shift`, `duplicate` |
| `employee.record_qr_checkin` | QR token + shift context → check-in event | Authenticated employee; server validates signed/rotating token, location, window and ownership | Mutates attendance context; unique employee/shift/check-in key; `invalid_token`, `outside_window`, `duplicate` |
| `employee.submit_availability` | planning period + available/unavailable intervals → submission | Authenticated employee; interval/schema and period validation | Mutates availability only; versioned/idempotent; `period_closed`, `invalid_interval` |
| `employee.request_time_off` | date range + optional minimal note → pending request | Authenticated employee; date and overlap validation | Mutates request only; idempotent; `invalid_range`, `duplicate` |
| `manager.generate_schedule_draft` | planning period → unpublished draft + uncovered shifts | Authenticated manager; deterministic constraints and eligible staff only | Mutates draft only; versioned; `no_feasible_assignment`, `stale_inputs` |
| `manager.publish_schedule` | draft ID + version → published schedule | Authenticated manager; revalidate constraints, no unresolved required fields | Mutates schedule; idempotency key and optimistic version; `conflict`, `unresolved_coverage` |
| `attendance.start_t_minus_5_check` | shift ID → call/skip/escalate | Internal scheduler only; checks T−10 window, check-in, delay notice and restaurant's preauthorized escalation policy | Mutates AttendanceCase; idempotent by shift+check-in window; `policy_disabled`, `already_resolved`, `no_candidate` |
| `voice.record_on_way_response` | attendance case + yes/ETA/absence → status | ElevenLabs agent scoped to active call; strict intent enum, call/employee binding, one clarification on ambiguity | Mutates AttendanceCase; provider call ID dedupe; `wrong_call`, `closed`, `ambiguous` |
| `attendance.configure_escalation_policy` | enabled flag, call window/timeouts, pre-approved coverage rules → policy version | Authenticated restaurant owner/manager only; employee check call fixed to one attempt; display consequences, require explicit save/authorization and audit actor | Mutates policy; versioned/idempotent; `forbidden`, `invalid_policy` |
| `attendance.start_preapproved_coverage` | attendance case → linked callout case + first eligible offer | Internal AttendanceService only; requires active policy authorized by manager, consent/contact window and deterministic eligibility | Mutates linked case/offers; one coverage search per attendance case; `policy_disabled`, `no_candidate`, `already_started` |
| `attendance.get_owner_metrics` | date range/location → counts, rates, lateness and evidence-source distribution | Authenticated owner/manager; tenant/location scope; suppress small cohorts where configured | No mutation; `forbidden`, `invalid_range` |

### Phase 3 payout tools (not callable by voice agent)

| Tool | Purpose / inputs → outputs | Caller & validation | Mutation / idempotency / errors |
|---|---|---|---|
| `payroll.import_validated_amount` | payroll reference + worker + completed shift + gross/net/currency → payable record | Trusted payroll adapter or payroll role; reconcile employee, shift, amount and period; no model-generated amounts | Mutates payable ledger; source reference unique; `unmatched_shift`, `invalid_amount`, `duplicate_reference` |
| `worker.preview_early_pay` | payable ID → amount, fees, expected timing, eligibility | Authenticated worker; show exact net amount and consent terms | No payout mutation; `not_eligible`, `missing_payroll_validation` |
| `manager.initiate_worker_payout` | payable ID + worker consent + idempotency key → payout ID/status | Authenticated manager/payroll role; validated payroll record, KYC/provider eligibility, not previously paid | Mutates payout ledger/external money movement; unique payable ID and idempotency; `already_paid`, `provider_unavailable`, `ineligible` |
| `payout.webhook.status` | signed provider event → reconciled status | Payout provider only; signature, account and payout IDs checked | Updates payout ledger only; dedupe provider event; `invalid_signature`, `unknown_payout`, `duplicate` |

## Reliability and separation
Verify all signed webhooks where supported. Persist provider event IDs and idempotency keys. Use transactional compare-and-set for offer acceptance and confirmation. Billing events update subscription/entitlement only; they never transition a callout. Provider timeout preserves the case and surfaces manual recovery.

Provider references: [ElevenLabs native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration), [Twilio outbound-call endpoint](https://elevenlabs.io/docs/eleven-agents/api-reference/integrations/twilio/outbound-call), [ElevenLabs webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools), [post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks). Confirm the exact account configuration and authentication/signature checks before live calls.
