# Acceptance criteria per feature

A feature is done when every line of its checklist passes. Tick them as you go.

## F0 — Foundations
As a developer, I need a stable base so later features only add behavior.
- [ ] Seed script creates 1 restaurant, 1 manager, ≥8 employees (varied roles, skills, availability, consent), ≥6 upcoming shifts.
- [ ] `AuditEvent`, `ProviderEvent` and idempotency-key storage exist and are used by every mutation.
- [ ] Adapter interfaces `VoiceProvider`, `BillingProvider` exist with a mock implementation each; mocks are visibly labeled in the UI/logs.

## F1 — Case lifecycle and manager dashboard
As a manager, I see callouts and move them through states.
- [ ] Dashboard form creates a callout case for an employee + shift (stand-in for voice) in `received`/`needs_review`.
- [ ] Case page shows employee, shift, deadline, verification flag, template summary and audit trail.
- [ ] Only an authenticated manager can approve/reject; illegal transitions are rejected by the server.

## F2 — Eligibility
As a manager, I want explainable candidates.
- [ ] Each seeded scenario in the test plan returns the expected eligible/ineligible set with reason codes.
- [ ] Output does not depend on anything but stored records (no external call).

## F3 — Offers, hold, confirmation
As a manager, I control who is contacted and who is assigned.
- [ ] Approval (with optional recipient edit) starts exactly one live offer at a time; first candidate decline/timeout advances to the next.
- [ ] Offer shows date, start/end, role and response deadline.
- [ ] First acceptance stops the sequence and sets `accepted_pending_manager`; shift is not assigned.
- [ ] Manager confirmation atomically assigns one employee, closes other offers, audits actor/time; repeat confirmation is rejected safely.
- [ ] Two simultaneous acceptances yield one held acceptance.

## F4 — Urgency
As a manager, I must not miss a callout.
- [ ] Case creation triggers a notification (stub allowed: visible toast + log line).
- [ ] An unapproved case triggers a reminder after the configured delay.
- [ ] A case whose shift has started is flagged "past deadline" in the dashboard.

## F5 — Inbound voice intake
As an employee, I explain naturally that I cannot work.
- [ ] Calling the Twilio number reaches the ElevenLabs agent; it states that it is automated.
- [ ] Agent tools: lookup caller → list that employee's upcoming shifts → create pending case. The shift ID passed must be one the server returned for that employee.
- [ ] Agent reads back employee, shift and intent; correction is possible; no promise of cover or approval.
- [ ] Exactly one pending case is created, with a reference; replaying the tool call creates no duplicate.
- [ ] Twilio `CallSid` and ElevenLabs `conversation_id` are stored on one `VoiceInteraction`.
- [ ] Unknown caller → unverified case for manager; two unclear answers → callback offer / manager-review case.

## F6 — Stripe subscription and entitlement
As a restaurant manager, I activate the product.
- [ ] Test checkout links account to Stripe customer/subscription IDs.
- [ ] Verified webhook updates subscription idempotently; replayed event has no second effect.
- [ ] Inactive entitlement blocks new intake and outreach; existing cases remain readable and unchanged.
- [ ] Browser redirect alone does not activate the account.

## F7 — Outbound voice offers
As a candidate, I get a short call with the offer.
- [ ] Backend persists a `CallAttempt` and idempotency key before calling ElevenLabs' Twilio outbound endpoint, then stores the returned IDs.
- [ ] Agent presents date/time/role and records yes/no through a scoped tool bound to that offer.
- [ ] Failure or no answer advances the sequence only after the outcome is resolved; the agent cannot pick recipients or start more calls.

## F8 — Time-off request
- [ ] A time-off intent creates a `TimeOffRequest` in `pending`; nothing is approved, no shift is touched.

## F9 — Portal and usage panel
- [ ] Dashboard shows subscription status and a Customer Portal link.
