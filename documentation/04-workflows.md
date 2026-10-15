> **Note (2026-10-03):** the hackathon build is in-app only (no SMS/voice). Voice sections below are post-hackathon. See the decision log in `09-open-decisions.md`.

# Workflows and state machines

## Entities with separate state
A `Case` and its `Offer`s have **separate** state machines. Attendance recovery is not employee-initiated callout intake: it is triggered by a missing check-in. Time-off is not a recovery case: it is a `TimeOffRequest` with its own tiny lifecycle. Billing has its own status and never touches either.

### Case (type = `callout`)
`received → needs_review → approved_for_outreach → offering → accepted_pending_manager → filled`

Terminal/side states: `rejected`, `cancelled`, `no_candidate` (list exhausted or empty; manager is alerted), `expired` (shift started with no fill). `needs_review` covers invalid attendance evidence, unclear employee response, or any case requiring a human look. There is no separate `needs_manager_action`.

### Offer
`queued → calling → accepted | declined | no_answer | failed | completed → closed`
One live offer (`calling`) per case at a time. A unique partial index enforces this. `accepted` is reachable once per case; accepting one offer closes remaining queued/calling attempts.

For the current Supabase implementation, manager confirmation is represented by `absence_cases.accepted_pending_manager`; automatic assignment moves the shift to `covered` and the case to `resolved` in the `respond_to_voice_offer` transaction.

### TimeOffRequest
`pending` only in the MVP.

### Rules
Only an active account and configured recovery policy authorize automated outreach. Acceptance is assignment only when automatic assignment is enabled; otherwise it remains held until manager confirmation. Every transition is audited, idempotent and enforced server-side. Retry/error metadata is stored separately from business state.

## Attendance recovery (F5)
1. The employee app displays a signed QR token bound to the employee and shift. A venue/manager scanner validates it and records check-in.
2. Check-in opens at `T−10`. The employee may declare “I’m late” in the app; this records a delay status without starting replacement outreach.
3. At `T−5`, if no valid check-in or late declaration exists, the server creates one attendance-recovery case using a shift-based idempotency key.
4. The system calls the scheduled employee once through the outbound voice provider. The agent states it is automated and records only `on_my_way`, `absent`, `no_answer`, or `unclear`.
5. `on_my_way` stops the recovery workflow. `absent`, `no_answer`, or `unclear` marks the scheduled employee unavailable and starts the first eligible replacement offer.
6. Replacement offers are dispatched one at a time in deterministic order. Decline, timeout, no answer, or failure advances to the next candidate; the first acceptance stops the sequence.
7. If automatic assignment is enabled, the first acceptance atomically assigns the shift. Otherwise it becomes `accepted_pending_manager` and the manager confirms or rejects it.
8. The manager is notified throughout; the dashboard shows attendance status, call outcome, candidate order, and assignment mode.

No LLM runs between the agent and the domain. Natural-language understanding is inside the ElevenLabs agent; the server only trusts validated structured arguments.

## Replacement outreach (F3/F5)
1. Server computes candidates using F2 reasons and the configured contact policy.
2. Server uses `candidate_ids` in deterministic order. For each next candidate it checks `contact_consent_at` and the restaurant-local contact window; skipped candidates are journaled. It persists a `CallAttempt` with a unique case/candidate idempotency key before dispatching through `VoiceProvider`.
3. Offer wording: “[Restaurant] has an open [role] shift on [date], [start] to [end]. Can you take it?” The response explains whether acceptance is held for manager confirmation or assigned automatically. Response deadline default 45 s for a call (configurable; longer for inbox).
4. The agent can call only `/api/voice/respond`, authenticated with `x-voice-secret`; the backend resolves `x-conversation-id` to the persisted attempt. A SQL transaction records yes/no idempotently. Decline, signed provider call-initiation failure, or the authenticated timeout sweep → next candidate. First acceptance → case `accepted_pending_manager` when configured, otherwise assignment and case resolution occur atomically.
5. In manual mode, the manager confirms; one transaction assigns the shift, sets `filled`, closes offers, and audits. In automatic mode, the acceptance transaction performs the same assignment without a second manager action.
6. If the list is exhausted → `unresolved` + manager alert/event in the current schema.

Sequential is a deliberate MVP choice (avoids double acceptance and keeps the manager’s approved order). Cost: a long list takes minutes. Parallel offers to the top N are a later option with single-winner semantics.

## Urgency (F4)
- On recovery-case creation: notify manager (channel: dashboard live update + one stub notification; real SMS/email post-MVP).
- Reminder if still unapproved after the configured delay.
- At shift start with no `filled` case: mark `expired` and alert.

## Subscription (F6)
1. Manager creates the demo account; app creates a Checkout session with the allowlisted price.
2. Manager completes test checkout.
3. Webhook handler verifies the signature, dedupes by event ID, upserts the subscription. Out-of-order events are resolved by retrieving the authoritative subscription state.
4. Entitlement is binary: `trialing`/`active` on; everything else off. Redirect alone grants nothing.

## Error handling
- Invalid/reused QR → reject the scan and do not create a recovery case.
- Unclear attendance response → do not infer intent; continue through the configured fallback path and alert the manager.
- ElevenLabs/Twilio outage or call-start failure → preserve the case, alert the manager, show manual contact action.
- Stripe outage/webhook delay → show "activation pending"; no access from redirect.
- Provider outage never changes existing case state.
