# Data model and API contract

## Bounded contexts
`Shift operations` and `Billing/entitlement` use separate tables and services. Stripe events cannot mutate shift state.

## Entities
- **RestaurantAccount:** `id`, `name`, `timezone`, `contact_window`, `min_rest_hours`, `reminder_delay_seconds`, `auto_assign_replacement`, `demo_seeded`.
- **RestaurantVoiceConfig:** `restaurant_account_id`, `elevenlabs_agent_id`, `elevenlabs_phone_number_id`, `twilio_phone_e164`, `outbound_enabled`. No secrets.
- **Subscription:** `restaurant_account_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `subscription_status`, `current_period_end`, `last_event_id`, `updated_at`.
- **Employee:** `id`, `restaurant_account_id`, `name`, `phone_e164`, `active`, `roles[]`, `skills[]`, `contact_consent_at|null`, `preferred_language`.
- **Availability:** `employee_id`, interval, `source`, `updated_at` (seeded in MVP).
- **Shift:** `id`, `restaurant_account_id`, `location_id`, interval, `role`, `required_skills[]`, `assigned_employee_id|null`, `status`, `check_in_opens_at` (= `start − 10 min`), `recovery_check_at` (= `start − 5 min`).
- **ShiftCheckIn:** `id`, `shift_id`, `employee_id`, `signed_token_id`, `scanned_at`, `scanner_id`, `status` (`valid|rejected|duplicate`), rejection code.
- **LateDeclaration:** `id`, `shift_id`, `employee_id`, `declared_at`, optional ETA, status.
- **Case:** `id`, `restaurant_account_id`, `employee_id`, `shift_id`, `status`, `trigger` (`missing_check_in`), `scheduled_employee_response`, `deadline_at` (= shift start), `reminded_at|null`, timestamps. MVP type is `attendance_recovery`.
- **TimeOffRequest:** `id`, `employee_id`, `starts_at`, `ends_at`, `status=pending`.
- **VoiceInteraction:** `id`, `case_id`, `direction=outbound`, `purpose` (`attendance_check|replacement_offer`), `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `language`, `started_at`, `ended_at`, `outcome`, `recording_enabled=false`, `transcript_retained=false`. No audio/transcript.
- **CallAttempt:** `id`, `offer_id`, `recipient_employee_id`, `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `idempotency_key`, `status` (`queued|initiated|ringing|answered|no_answer|failed|completed`), `failure_code|null`, timestamps.
- **Offer:** `id`, `case_id`, `candidate_employee_id`, `position`, `status`, `channel` (`voice|demo_inbox`), `sent_at`, `expires_at`, `responded_at|null`, `call_attempt_id|null`.
- **EligibilityResult:** `case_id`, `employee_id`, `eligible`, `reason_codes[]`, `computed_at`.
- **AuditEvent:** `id`, `restaurant_account_id`, `case_id|null`, `actor`, `event_type`, minimal payload, `at`.
- **ProviderEvent:** `provider`, unique `provider_event_id`, status, timestamps, minimal error.

Broader attendance analytics and planning entities remain in `ROADMAP.md`; the minimum check-in and recovery records above are part of the MVP contract.

## Internal API
- `issue_shift_qr(employee_id, shift_id, idempotency_key)` → signed, time-bound employee/shift token.
- `record_check_in(token, scanner_id, idempotency_key)` → valid check-in or rejection reason.
- `declare_late(employee_id, shift_id, eta|null, idempotency_key)` → recorded late status; no replacement outreach.
- `start_attendance_recovery(shift_id, idempotency_key)` → one recovery case at `T−5` when no check-in/late declaration exists.
- `record_attendance_response(case_id, response, provider_event_id)` → `on_my_way|absent|no_answer|unclear`.
- `get_eligible_candidates(case_id)` → ordered candidates with reason codes.
- `manager_decide(case_id, decision, candidate_ids[], manager_id, idempotency_key)`.
- `send_next_offer(case_id, idempotency_key)` → one offer, approved cases only.
- `respond_to_offer(offer_id, response, provider_event_id)` → accepted/declined/expired; accepted is held or assigned according to `auto_assign_replacement`.
- `confirm_replacement(case_id, offer_id, manager_id, idempotency_key)` → required only in manual mode.
- `create_checkout_session(account_id, idempotency_key)`; `handle_stripe_webhook(raw_body, signature)`; `get_entitlement(account_id)`.
- `start_elevenlabs_twilio_call(...)` → `{success, conversation_id?, callSid?}`; backend only, after domain authorization and `CallAttempt` persistence; `call_recording_enabled=false`.

## Permissions
The outbound agent may submit only the response for its bound attendance call or replacement offer. It cannot select recipients, compute eligibility, change assignment mode, or mutate billing. A manager controls assignment mode; only manual mode requires manager confirmation. Every mutation is audited and idempotent.

## Privacy and retention
No medical details, no raw transcript/audio by default. Store IDs, language, outcome and short note only. Provider-side retention to be confirmed in the spike. Define deletion/retention before any pilot.
