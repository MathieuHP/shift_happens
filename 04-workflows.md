# Workflow and conversation design

## Subscription activation
1. Manager creates the single demo restaurant account.
2. Application creates a Checkout session for the configured plan (**Stripe API/version and exact available hackathon tools: TO VERIFY**).
3. Manager completes Stripe test-mode checkout.
4. Stripe sends a subscription event to the billing webhook; handler verifies signature, deduplicates event ID and upserts subscription state.
5. Entitlement service maps `trialing|active` to enabled access. Dashboard shows status. Duplicate/reordered events cannot downgrade newer state without retrieving/reconciling authoritative subscription state (**TO VERIFY**).
6. Customer Portal link is shown if practical. Billing remains a separate bounded context.

## Inbound callout flow
1. **Inbound telephony:** employee calls the restaurant Twilio number connected to the ElevenLabs Conversational AI agent through the native Twilio integration. The agent discloses automation and recording policy (recording off by default), then collects natural speech. Verify the provisioned Twilio number is imported/connected to the intended agent.
2. **Voice tool:** use narrow authenticated application tools to match caller and list that employee's upcoming shifts. Never accept a model-supplied employee identity without server-side verification.
3. **Ingram:** receive only minimum speech text/context and return a strict schema: `intent`, `date_time_expression`, `shift_reference`, `optional_note`, `confidence`, `ambiguities`. Ingram identifiers/schema support are **TO VERIFY**.
4. **Application validation:** validate enum/schema, confidence threshold, time zone, employee ownership and shift match. Resolve dates against stored shifts using deterministic rules. On ambiguity ask a targeted question; on invalid/low-confidence output, retry once or route to manager.
5. **ElevenLabs:** read back employee, shift, intent and ask for correction/confirmation. Do not promise coverage or approval.
6. **Application:** `create_callout` stores a pending case and minimal inference trace; idempotency prevents duplicates. `time_off` stays pending.
7. **Manager:** reviews case and explicitly authorizes outreach. Voice agent cannot invoke this permission.
8. **Application:** deterministic eligibility service filters and ranks candidates. Dashboard shows reasons.
9. **Outbound offer call:** after manager approval, application requests one call through ElevenLabs Conversational AI's Twilio integration; agent presents shift details and captures yes/no. Application chooses each candidate sequentially and checks consent/contact window. Store Twilio `CallSid` and ElevenLabs `conversation_id`. The agent cannot select recipients or independently start additional calls. If outbound wiring is blocked, use a labeled demo inbox/mock.
10. **Application:** record response idempotently, stop after first valid acceptance, set `accepted_pending_manager`.
11. **Manager:** confirms in dashboard; server atomically assigns and transitions to `filled`.

## State machine
`received → needs_review → approved_for_outreach → offering → accepted_pending_manager → filled`

Existing holding/terminal states: `cancelled`, `no_candidate`, `needs_manager_action`, `time_off_pending`. No new business state is needed for billing or provider errors; retain operational retry/error metadata separately.

Rules for the callout workflow: only manager authorizes outreach; one live offer at a time; acceptance is not assignment; only manager confirmation assigns; every retry is idempotent. The separate attendance escalation may call the pre-approved list only under the previously enabled/authorized attendance policy.

## Candidate wording
“[Restaurant] has an open [role] shift on [date], [start] to [end]. Are you available and willing to take it? An acceptance is pending manager confirmation.”

## Roadmap workflow — lateness, callout and attendance (Phase 1)
1. **Advance notice:** employee opens app, selects/auto-resolves the upcoming shift, enters optional expected arrival time, confirms. Application validates shift ownership, stores a `DelayNotice` and alerts manager. Do not ask for a reason. A notice before T−5 suppresses the scheduled check-in call.
2. **Clocking window:** open employee check-in at `T−10 = shift_start − 10 minutes`. A valid QR/app check-in records server time and suppresses the T−5 call.
3. **Automated check:** if neither notice nor check-in exists at `T−5`, AttendanceService requests one outbound call from the application adapter. The adapter calls ElevenLabs' Twilio outbound-call endpoint; ElevenLabs starts the Twilio call. The agent asks: “Your shift starts in five minutes. Are you on your way?” Persist the returned `conversation_id` and `CallSid` against the AttendanceCase.
4. If employee confirms they are on the way or supplies an ETA, record `OnWayConfirmation`, stop the escalation sequence, and show the self-reported status/ETA to manager. Do not call replacements. If ETA later passes without check-in, alert manager; do not restart calls automatically by default.
5. If the employee says they will not attend, mark the attendance case as absence-confirmed and begin the approved fallback sequence. If the employee does not answer the single call, mark `unconfirmed_no_response` and begin the same sequence. No speech inference alone changes status: yes/no intent must be schema-validated, and an unclear answer gets one clarification during the call, then follows the no-response path.
6. **Replacement sequence:** only when the restaurant has enabled automated coverage and a manager has configured/authorized it in advance, create a linked `attendance_no_show` CalloutCase with `outreach_authorization=preauthorized_policy`; compute eligible candidates in deterministic server code. The application initiates one ElevenLabs/Twilio outbound call per candidate. Decline/no answer advances to the next candidate; acceptance stops the sequence and becomes `accepted_pending_manager`. Manager confirmation is still required to assign. If policy is disabled, list exhausted, or no eligible candidate exists, alert manager instead.
7. **Arrival record:** employee scans signed/rotating location QR or uses approved app check-in. Server checks token/location, employee, shift window and duplicate key, then records `CheckInEvent` with server timestamp. QR token rotation/replay protection is **TO VERIFY**.
8. If scan is late relative to scheduled start plus configured grace period, flag it as late and calculate minutes. Do not infer cause or recommend discipline. A late check-in after escalation starts stops further candidate calls only if the manager/system policy explicitly defines it as resolution; default is manager review if a replacement has already accepted.
9. Dashboard reports shift/presence/lateness and source confidence. Confidence describes evidence quality (verified QR/app, employee self-report, manager correction, missing/unconfirmed), not worker reliability.

Dashboard metric definitions: show published shift start/end and scheduled duration; checked-in means a valid check-in event; attendance confirmed means manager-confirmed attendance. Late means first check-in later than scheduled start plus configured grace; lateness minutes are max(0, check-in time − scheduled start). Report absence-confirmed and unconfirmed/no-response separately. Do not equate check-in with completed shift or payroll-approved hours.

## Roadmap workflow — availability and schedule planning (Phase 2)
1. Manager opens a planning period; employees submit availability and date-bounded time-off requests by deadline.
2. Application validates inputs and presents missing responses/conflicts; AI may summarize only, never decide availability or leave.
3. Scheduler creates an unpublished draft using deterministic role/skill, availability, rest/overlap and configured coverage rules. It may show unresolved shifts; it must not fabricate coverage.
4. Manager reviews, edits, explicitly approves/rejects leave requests, then publishes the schedule. Publishing is an authenticated, audited action.
5. Employees receive the published schedule. Later changes go through a tracked manager action; the callout replacement workflow remains available for urgent absences.

These roadmap flows use separate `AttendanceCase`, `DelayNotice`, `OnWayConfirmation`, `CheckInEvent`, `AvailabilitySubmission`, `TimeOffRequest` and `ScheduleDraft` records. They do not add states to the callout state machine. For coverage, an `AttendanceCase` may initiate the existing offer sequence; the result still uses existing offer and manager-confirmation states.

## Roadmap workflow — accelerated worker pay (Phase 3)
1. Manager/payroll provider closes the shift and confirms actual payable hours; QR check-in alone is not authoritative payroll evidence.
2. Existing payroll process calculates gross pay, deductions and net pay under the applicable contract/sector rules, then returns a validated payroll reference and eligible net amount to the payout module.
3. Entitlement, identity/KYC, bank account and provider country/instant-payout eligibility are checked. Worker sees amount, destination, fees (if any), timing and terms and explicitly opts in.
4. Authorized manager/payroll role approves the payout. Application sends one idempotent payout instruction through Stripe Connect or another verified provider. Exact Connect account model, API/tool access and eligibility in Belgium are **TO VERIFY**.
5. Webhook/status polling updates `pending → paid|failed|reversed`; do not mark paid merely because a request was accepted. Reconcile against payroll reference and provider transfer/payout IDs.
6. Failure leaves payroll liability intact and surfaces standard payroll-payment fallback. Do not automatically retry with a new payout ID.

This flow is separate from Stripe SaaS billing and from shift/callout state. Belgian wage-payment timing and student-contract terms require validation for each employer/sector; do not assume end-of-shift transfer is compliant or that a bank payout arrives instantly.

## Error handling
- Unknown caller: collect ID/name, create unverified case; manager review required.
- Ambiguous shift: offer the two next shifts and ask; if still unclear, manager review.
- Speech unclear twice: offer transfer/callback; no inferred action.
- Ingram/ElevenLabs outage: create/continue via dashboard manual path; preserve existing state and show provider failure.
- Stripe outage/webhook delay: show pending activation; do not grant entitlement on browser redirect alone.
- Twilio or ElevenLabs call initiation failure: retain the case, alert manager and show manual contact action. Record call initiation failure/status callbacks where configured; exact callback events and signature validation are **TO VERIFY** in the provisioned setup.
