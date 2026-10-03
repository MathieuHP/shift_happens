# Data model and API contract

## Bounded contexts
`Shift operations` and `Billing/entitlement` have separate tables/services. A restaurant account is referenced by shift records, but Stripe events cannot mutate shift workflow state.

## Entities
- **RestaurantAccount:** `id`, `name`, `timezone`, `created_at`, `demo_seeded`.
- **RestaurantVoiceConfig:** `restaurant_account_id`, `telephony_provider=twilio`, `elevenlabs_agent_id`, `elevenlabs_phone_number_id`, `twilio_phone_e164`, `inbound_enabled`, `outbound_enabled`, `updated_by`, `updated_at`. No API secrets stored in this row.
- **Subscription:** `id`, `restaurant_account_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `subscription_status` (`trialing|active|past_due|canceled`), `current_period_end|null`, `last_event_id`, `updated_at`.
- **Employee:** `id`, `restaurant_account_id`, `name`, `phone_e164`, `active`, `roles[]`, `skills[]`, `contact_consent_at|null`, `preferred_language`.
- **Availability:** `employee_id`, interval, `status`, `source`, `updated_at`.
- **Shift:** `id`, `restaurant_account_id`, `location_id`, interval, `role`, `required_skills[]`, `assigned_employee_id|null`, `status`.
- **CalloutCase:** `id`, `restaurant_account_id`, `employee_id|null`, `shift_id|null`, `type` (`callout|time_off|attendance_no_show`), `status`, `caller_verified`, `employee_note|null`, `attendance_case_id|null`, `outreach_authorization` (`manager_action|preauthorized_policy|null`), `authorization_policy_id|null`, timestamps. Note is optional, short, non-medical and retention-limited. A policy-authorized attendance case records which manager-approved policy initiated outreach.
- **VoiceInteraction:** `id`, `case_id|null`, `attendance_case_id|null`, `provider=elevenlabs`, `transport=twilio`, `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `direction`, `language`, `started_at`, `ended_at|null`, `inference_trace_id|null`, `schema_version|null`, `confidence|null`, `validation_outcome|null`, `recording_enabled=false`, `transcript_retained=false` by default. Do not store raw audio/transcript by default.
- **CallAttempt:** `id`, `workflow_id`, `recipient_employee_id`, `purpose` (`callout_offer|t_minus_5_check|attendance_replacement`), `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `idempotency_key`, `status` (`queued|initiated|ringing|answered|no_answer|failed|completed`), `failure_code|null`, timestamps. One row per initiated attempt; dedupe internal retries before placing another call.
- **Offer:** `id`, `case_id`, `candidate_employee_id`, `status`, `sent_at`, `expires_at`, `responded_at|null`, `call_attempt_id|null`.
- **AuditEvent:** `id`, `restaurant_account_id`, `case_id|null`, actor, event type, minimal payload, timestamp.
- **ProviderEvent:** provider, unique `provider_event_id`, received/processed status, timestamps, minimal error; used for dedupe.

## Roadmap entities (Phase 1–2; not hackathon MVP)
- **AttendanceCase:** `id`, `employee_id`, `shift_id`, `checkin_opens_at` (shift start −10m), `employee_call_due_at` (shift start −5m), `status` (`awaiting_checkin|on_way|absence_confirmed|unconfirmed_no_response|coverage_offered|manager_action|resolved`), `automation_policy_id|null`, timestamps.
- **DelayNotice:** `id`, `restaurant_account_id`, `employee_id`, `shift_id`, `reported_at`, `expected_arrival_at|null`, `status`, `created_at`. Avoid a free-text reason by default.
- **OnWayConfirmation:** `id`, `attendance_case_id`, `twilio_call_sid|null`, `elevenlabs_conversation_id|null`, `response` (`on_way|will_not_attend|unclear|no_answer`), `expected_arrival_at|null`, `recorded_at`, `validation_outcome`.
- **CheckInEvent:** `id`, `employee_id`, `shift_id`, `location_id`, `server_recorded_at`, `qr_token_id`, `idempotency_key`. Store no precise GPS by default. Treat QR time as an operational check-in, not payroll-grade proof.
- **AttendanceAutomationPolicy:** `id`, `restaurant_account_id`, `enabled`, `authorized_by_manager_id`, `authorized_at`, `candidate_contact_window`, `employee_call_attempts=1`, `employee_answer_timeout_seconds`, `replacement_timeout_seconds`, `version`. Any policy edit is authenticated and audited.
- **AttendanceEvidence:** `attendance_case_id`, `source` (`signed_qr|app_checkin|employee_self_report|manager_correction|no_response`), `confidence_level` (`high|medium|low|unknown`), `reason_code`, `recorded_at`. Confidence level is provenance/data quality only.
- **AttendanceReview:** `id`, `shift_id`, `employee_id`, `status` (`attendance_confirmed|absence_confirmed|unresolved`), `reviewed_by_manager_id|null`, `reviewed_at|null`, `source_event_ids[]`. This is not a payroll calculation or proof of total hours.
- **AvailabilitySubmission:** `id`, `employee_id`, `planning_period_id`, `intervals[]`, `submitted_at`, `version`.
- **TimeOffRequest:** `id`, `employee_id`, `starts_at`, `ends_at`, `status` (`pending|approved|rejected|withdrawn`), `manager_id|null`, decision timestamp. Medical details are excluded.
- **PlanningPeriod:** `id`, `restaurant_account_id`, `starts_at`, `ends_at`, `submission_deadline`, `status`.
- **ScheduleDraft:** `id`, `planning_period_id`, `version`, proposed assignments, uncovered shifts, constraint results, `status` (`draft|published|superseded`), `published_by|null`, `published_at|null`.

QR token rotation/signature, replay protection and retention duration are **TO VERIFY** before QR check-in is used operationally.

## Phase 3 payout entities (not hackathon MVP)
- **PayableShift:** `id`, `employee_id`, `shift_id`, `payroll_reference`, `approved_hours`, `gross_amount`, `net_amount`, `currency`, `payroll_validated_at`, `approved_by`, `status`. Amounts originate from an authorized payroll process, never from the voice/inference model.
- **WorkerPayout:** `id`, `payable_shift_id`, `provider`, `connected_account_id|null`, `provider_transfer_id|null`, `provider_payout_id|null`, `amount`, `currency`, `status` (`previewed|authorized|pending|paid|failed|reversed`), `worker_consent_at`, `initiated_by`, timestamps, `idempotency_key`.
- Keep payout IDs and payroll references for reconciliation; do not store full bank credentials. KYC/account onboarding should be delegated to the regulated provider flow where possible.

## API/tool contracts
Internal application contracts (provider API details are linked and described in `05-architecture.md`; account configuration remains **TO VERIFY**):
- `lookup_employee(caller_phone|employee_id)` → verified match/unverified result.
- `list_upcoming_shifts(employee_id, from, to)` → shifts; employee scope enforced.
- `extract_callout_intent(minimal_text, locale, allowed_shift_context)` → `{intent, date_expression, shift_reference, optional_note, confidence, ambiguities[], trace_id}`. Strict schema; no business action.
- `create_callout(employee_id, shift_id, type, validated_note?, idempotency_key)` → pending case; no approval fields accepted.
- `get_eligible_candidates(shift_id, exclude_employee_id)` → deterministic eligible candidates and rule reasons.
- `manager_decide(case_id, decision, candidate_ids[], manager_id, idempotency_key)` → approved/rejected; server recomputes eligibility.
- `send_next_offer(case_id, idempotency_key)` → one offer; only approved cases.
- `respond_to_offer(offer_id, response, provider_event_id/idempotency_key)` → held/declined/expired.
- `confirm_replacement(case_id, offer_id, manager_id, idempotency_key)` → atomic assignment and closure.
- `create_checkout_session(account_id, configured_plan, idempotency_key)` → checkout URL/session reference.
- `handle_stripe_webhook(raw_body, signature)` → verified/deduplicated processing outcome; billing tables only.
- `get_entitlement(account_id)` → status and allowed product capabilities.
- `start_elevenlabs_twilio_call(agent_id, agent_phone_number_id, to_number, conversation_initiation_client_data?)` → `{success, conversation_id?, callSid?}`; backend only, after domain authorization and call-attempt persistence.
- Phase 1: `report_delay(employee_id, shift_id, expected_arrival_at?, idempotency_key)`; `record_qr_checkin(employee_id, qr_token, shift_id, idempotency_key)`.
- Phase 1: `start_t_minus_5_check(shift_id)`; `record_on_way_response(attendance_case_id, response, eta?, twilio_call_sid, elevenlabs_conversation_id)`; `get_owner_attendance_metrics(account_id, date_range, location_id?)`.
- Voice provider: ElevenLabs `POST /v1/convai/twilio/outbound-call` with server-side `agent_id`, `agent_phone_number_id`, `to_number`, optional initiation client data and `call_recording_enabled=false`; response includes `conversation_id` and `callSid` when present. Internal CallAttempt key is required even if provider-side idempotency is unavailable.
- Phase 1 manager configuration: `configure_attendance_escalation_policy(account_id, enabled, contact_window, attempts, candidate_rules, manager_id, idempotency_key)`.
- Phase 2: `submit_availability(employee_id, period_id, intervals, version)`; `request_time_off(employee_id, starts_at, ends_at, idempotency_key)`; `generate_schedule_draft(period_id, manager_id)`; `publish_schedule(draft_id, version, manager_id, idempotency_key)`.
- Phase 3: `import_validated_payable(payroll_reference, employee_id, shift_id, gross, net, currency)`; `preview_worker_payout(payable_id)`; `initiate_worker_payout(payable_id, worker_consent, manager_id, idempotency_key)`; `handle_payout_webhook(raw_body, signature)`.

## Permissions
Voice agent may lookup, list shifts, create pending cases and submit response only for a scoped open offer. It cannot authorize outreach, approve time off or assign shifts. Candidate may respond only to their own offer. For absence escalation, a restaurant manager must first enable and authorize a specific automation policy; the service may then initiate only the preconfigured sequential outreach. A manager alone confirms the final assignment. Billing webhook can update Subscription only. In roadmap phases, an employee may submit their own delay, check-in, availability and leave request; only a manager may decide leave or publish a schedule. Every state mutation is audited and idempotent.

Payout permission boundary: only trusted payroll integration/payroll role can create a validated payable amount; worker must see and consent to a payout preview; authorized employer manager/payroll role triggers payout; provider webhooks change payout status only. No provider webhook can alter a callout or schedule record.

## Privacy and retention
Avoid medical diagnosis and detailed reasons. Do not persist raw transcript/audio; if a provider retains data, retention/configuration is **TO VERIFY**. Keep only minimal structured extraction and trace metadata. Define deletion/retention before pilot.
