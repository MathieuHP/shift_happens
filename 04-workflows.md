# Workflows and state machines

## Entities with separate state
A `Case` and its `Offer`s have **separate** state machines. Time-off is not a callout: it is a `TimeOffRequest` with its own tiny lifecycle. Billing has its own status and never touches either.

### Case (type = `callout`)
`received → needs_review → approved_for_outreach → offering → accepted_pending_manager → filled`

Terminal/side states: `rejected`, `cancelled`, `no_candidate` (list exhausted or empty; manager is alerted), `expired` (shift started with no fill). `needs_review` covers every case that needs a human look: unverified caller, ambiguous shift, low-quality voice interaction. There is no separate `needs_manager_action`.

### Offer
`queued → calling → accepted | declined | no_answer | expired | failed → closed`
One live offer (`calling`) per case at a time. `accepted` is reachable once per case; confirming one offer sets all others `closed`.

### TimeOffRequest
`pending` only in the MVP.

### Rules
Only a manager authorizes outreach. Acceptance is not assignment. Only manager confirmation assigns. Every transition is audited, idempotent and enforced server-side. Retry/error metadata is stored separately from business state.

## Inbound callout (F5)
1. Employee calls the Twilio number routed to the ElevenLabs agent. Agent states it is an automated assistant (recording off).
2. Agent calls `lookup_employee(caller)`; server returns a verified match or "unverified". The agent cannot supply an identity.
3. Agent calls `list_upcoming_shifts(employee)` and asks the employee which shift, offering the next ones from the returned list. Ambiguity: offer the next two shifts; still unclear → manager-review case.
4. Agent reads back employee, shift and intent (`callout` or `time_off`) and asks for confirmation.
5. Agent calls `create_pending_callout(shift_id, type, idempotency_key)`. Server checks: employee verified, shift ∈ that employee's upcoming shifts, entitlement active, no duplicate. It stores a pending case and the `VoiceInteraction` (provider IDs, language, outcome; no transcript).
6. Agent tells the employee the manager has been notified; it does not promise coverage.
7. Manager is notified (F4); case shows a template summary of structured fields only.

No LLM runs between the agent and the domain. Natural-language understanding is inside the ElevenLabs agent; the server only trusts validated structured arguments.

## Outreach (F3, voice in F7)
1. Manager reviews candidates (F2 reasons) and approves, optionally editing the list.
2. Server queues offers in deterministic order. For the next offer it checks consent and contact window, then dispatches: demo inbox (F3) or one outbound ElevenLabs/Twilio call (F7).
3. Offer wording: “[Restaurant] has an open [role] shift on [date], [start] to [end]. Can you take it? Your yes is held until the manager confirms.” Response deadline default 45 s for a call (configurable; longer for inbox).
4. Response recorded idempotently. Decline/no answer/expiry → next candidate. First acceptance → case `accepted_pending_manager`, remaining offers `closed`.
5. Manager confirms; one transaction assigns the shift, sets `filled`, closes offers, audits.
6. If the list is exhausted → `no_candidate` + manager alert.

Sequential is a deliberate MVP choice (avoids double acceptance and keeps the manager’s approved order). Cost: a long list takes minutes. Parallel offers to the top N are a later option with single-winner semantics.

## Urgency (F4)
- On case creation: notify manager (channel: dashboard live update + one stub notification; real SMS/email post-MVP).
- Reminder if still unapproved after the configured delay.
- At shift start with no `filled` case: mark `expired` and alert.

## Subscription (F6)
1. Manager creates the demo account; app creates a Checkout session with the allowlisted price.
2. Manager completes test checkout.
3. Webhook handler verifies the signature, dedupes by event ID, upserts the subscription. Out-of-order events are resolved by retrieving the authoritative subscription state.
4. Entitlement is binary: `trialing`/`active` on; everything else off. Redirect alone grants nothing.

## Error handling
- Unknown caller → unverified case; manager review.
- Speech unclear twice → callback offer or manager-review case; no inferred action.
- ElevenLabs/Twilio outage or call-start failure → preserve the case, alert the manager, show manual contact action.
- Stripe outage/webhook delay → show "activation pending"; no access from redirect.
- Provider outage never changes existing case state.
