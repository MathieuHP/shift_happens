# Roadmap (post-MVP, not built during the hackathon)

Everything here is deliberately outside `02-mvp-requirements.md`. Nothing in this file should leak into the MVP demo, tests or data model. Full earlier detail (tools, entities, test cases) remains in git history before the "MVP-only" restructuring.

## Phase 1 — Lateness and no-show escalation
- Employee reports an expected delay in the app (optional ETA, no reason asked). Manager is alerted; no replacement outreach starts by itself.
- Check-in opens at `T−10` (`shift_start − 10 min`). If there is neither a delay notice nor a valid check-in at `T−5`, ElevenLabs calls the scheduled employee **once**.
  - "On my way" / valid ETA → stop; show self-reported status to manager.
  - Absence confirmed or no answer → sequential calls to replacements, **only** if the restaurant enabled the policy and a manager pre-authorized contact window, candidate rules and fallback. Disabled by default.
  - Replacement acceptance is still `accepted_pending_manager`; the manager confirms.
- QR/app check-in records operational arrival time (signed/rotating token, location + shift window, duplicate key). It is not proof of worked hours or payroll data.
- Owner attendance dashboard: scheduled start/end/duration, checked in, manager-confirmed attendance, late (first check-in > start + configured grace), minutes late (floored at 0), absence-confirmed vs no-response shown separately. "Evidence confidence" = source quality only (high: validated QR/app; medium: self-report or manager correction; low: none). Never a worker score, ranking or discipline input.
- **Gate before building:** Belgian workplace-monitoring/data-protection review, employee notice, retention and correction process, call consent/contact hours.

## Phase 2 — Availability and schedule drafting
- Employees submit availability and date-bounded time-off requests for a planning period.
- Deterministic draft from role/skill, availability, rest/overlap and coverage rules; uncovered shifts stay visible, nothing is invented.
- Manager edits, decides every leave request explicitly, then publishes (audited). Later changes go through tracked manager actions; callout flow stays the urgent path.
- **Gate:** define period, deadlines, rest rules, fairness constraints, handling of incomplete submissions.

## Parked — accelerated worker pay (formerly Phase 3)
Not pursued for now: it is a different product (payroll integration, wage-payment timing law, Stripe Connect KYC, student contracts) and would change the company's risk profile. If it is ever revisited: payroll must supply validated net amounts; Stripe Billing (restaurant SaaS) stays separate from any payout rail; never market "instant salary" before Belgian legal treatment, bank timing and fees are confirmed (see SPF Emploi pages on payment dates and student contracts, and Stripe Payouts docs).
