# Acceptance criteria per feature

A feature is done when every line of its checklist passes. Tick them as you go.

## F0 — Foundations
As a developer, I need a stable base so later features only add behavior.
- [ ] Seed script creates 1 restaurant, 1 manager, ≥8 employees (varied roles, skills, availability, consent), ≥6 upcoming shifts.
- [ ] `AuditEvent`, `ProviderEvent` and idempotency-key storage exist and are used by every mutation.
- [ ] Adapter interfaces `VoiceProvider`, `BillingProvider` exist with a mock implementation each; mocks are visibly labeled in the UI/logs.

## F1 — Attendance-recovery case lifecycle and manager dashboard
As a manager, I see missing check-ins and move recovery cases through states.
- [ ] A missing-check-in event creates an attendance-recovery case for an employee + shift in `received`/`needs_review`.
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
As a manager, I must not miss a missing check-in.
- [ ] Recovery-case creation triggers a notification (stub allowed: visible toast + log line).
- [ ] An unresolved recovery case triggers a reminder after the configured delay.
- [ ] A case whose shift has started is flagged "past deadline" in the dashboard.

## F5 — Outbound attendance check and replacement cascade
As a manager, I want the system to react when an employee has not checked in.
- [ ] Employee app generates a signed QR token bound to exactly one employee and shift.
- [ ] Venue/manager scanner accepts a valid token and rejects wrong-employee, expired, reused, or invalid tokens.
- [ ] Check-in opens at `T−10`; a missing check-in at `T−5` creates exactly one recovery case.
- [ ] Employee can declare “I’m late” before `T−5`; this prevents the recovery call and records the declaration.
- [ ] System calls the scheduled employee once and records only `on_my_way`, `absent`, `no_answer`, or `unclear`.
- [ ] `on_my_way` stops the cascade; `absent`, `no_answer`, or `unclear` starts the next eligible replacement call.
- [ ] Replacement calls proceed strictly one at a time and advance idempotently after decline, timeout, no answer, or failure.
- [ ] Manager setting controls automatic assignment versus `accepted_pending_manager` confirmation.
- [ ] Replayed scheduler or provider callbacks create no duplicate case, call, or assignment.

## F6 — Stripe subscription and entitlement
As a restaurant manager, I activate the product.
- [ ] Test checkout links account to Stripe customer/subscription IDs.
- [ ] Verified webhook updates subscription idempotently; replayed event has no second effect.
- [ ] Inactive entitlement blocks new intake and outreach; existing cases remain readable and unchanged.
- [ ] Browser redirect alone does not activate the account.

## F7 — Absorbed into F5
Outbound voice offers are covered by F5 and are not a separate feature.

## F8 — Time-off request
- [ ] A time-off intent creates a `TimeOffRequest` in `pending`; nothing is approved, no shift is touched.

## F9 — Portal and usage panel
- [ ] Dashboard shows subscription status and a Customer Portal link.
