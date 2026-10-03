# Data model and API contract

## Bounded contexts
`Shift operations` and `Billing/entitlement` use separate tables and services. Stripe events cannot mutate shift state.

## Entities
- **RestaurantAccount:** `id`, `name`, `timezone`, `contact_window`, `min_rest_hours`, `reminder_delay_seconds`, `demo_seeded`.
- **RestaurantVoiceConfig:** `restaurant_account_id`, `elevenlabs_agent_id`, `elevenlabs_phone_number_id`, `twilio_phone_e164`, `inbound_enabled`, `outbound_enabled`. No secrets.
- **Subscription:** `restaurant_account_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `subscription_status`, `current_period_end`, `last_event_id`, `updated_at`.
- **Employee:** `id`, `restaurant_account_id`, `name`, `phone_e164`, `active`, `roles[]`, `skills[]`, `contact_consent_at|null`, `preferred_language`.
- **Availability:** `employee_id`, interval, `source`, `updated_at` (seeded in MVP).
- **Shift:** `id`, `restaurant_account_id`, `location_id`, interval, `role`, `required_skills[]`, `assigned_employee_id|null`, `status`.
- **Case:** `id`, `restaurant_account_id`, `employee_id|null`, `shift_id|null`, `status`, `caller_verified`, `deadline_at` (= shift start), `employee_note|null` (short, non-medical, retention-limited), `reminded_at|null`, timestamps. MVP type is `callout`.
- **TimeOffRequest:** `id`, `employee_id`, `starts_at`, `ends_at`, `status=pending`.
- **VoiceInteraction:** `id`, `case_id|null`, `direction`, `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `language`, `started_at`, `ended_at`, `outcome`, `recording_enabled=false`, `transcript_retained=false`. No audio/transcript.
- **CallAttempt:** `id`, `offer_id`, `recipient_employee_id`, `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `idempotency_key`, `status` (`queued|initiated|ringing|answered|no_answer|failed|completed`), `failure_code|null`, timestamps.
- **Offer:** `id`, `case_id`, `candidate_employee_id`, `position`, `status`, `channel` (`voice|demo_inbox`), `sent_at`, `expires_at`, `responded_at|null`, `call_attempt_id|null`.
- **EligibilityResult:** `case_id`, `employee_id`, `eligible`, `reason_codes[]`, `computed_at`.
- **AuditEvent:** `id`, `restaurant_account_id`, `case_id|null`, `actor`, `event_type`, minimal payload, `at`.
- **ProviderEvent:** `provider`, unique `provider_event_id`, status, timestamps, minimal error.

Roadmap entities (attendance, planning) live in `ROADMAP.md` and are not created in the MVP.

## Internal API
- `lookup_employee(caller_phone|employee_id)` → verified match or unverified.
- `list_upcoming_shifts(employee_id, from, to)` → shifts (employee scope).
- `create_callout(employee_id, shift_id, type, idempotency_key)` → pending case. Accepts no approval fields.
- `get_eligible_candidates(case_id)` → ordered candidates with reason codes.
- `manager_decide(case_id, decision, candidate_ids[], manager_id, idempotency_key)`.
- `send_next_offer(case_id, idempotency_key)` → one offer, approved cases only.
- `respond_to_offer(offer_id, response, provider_event_id)` → held/declined/expired.
- `confirm_replacement(case_id, offer_id, manager_id, idempotency_key)`.
- `create_checkout_session(account_id, idempotency_key)`; `handle_stripe_webhook(raw_body, signature)`; `get_entitlement(account_id)`.
- `start_elevenlabs_twilio_call(...)` → `{success, conversation_id?, callSid?}`; backend only, after domain authorization and `CallAttempt` persistence; `call_recording_enabled=false`.

## Permissions
The agent may look up, list shifts, create a pending case, and answer only its own open offer. It cannot authorize outreach, approve leave or assign. Candidates answer only their own offer. Only a manager confirms. The billing webhook updates `Subscription` only. Every mutation is audited and idempotent.

## Privacy and retention
No medical details, no raw transcript/audio by default. Store IDs, language, outcome and short note only. Provider-side retention to be confirmed in the spike. Define deletion/retention before any pilot.
