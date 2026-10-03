# Roadmap (post-MVP, not built during the hackathon)

Everything here is deliberately outside `02-mvp-requirements.md`. Nothing in this file should leak into the MVP demo, tests or data model. Full earlier detail (tools, entities, test cases) remains in git history before the "MVP-only" restructuring.

## Phase 1 — Broader attendance analytics
The minimum QR check-in and outbound recovery flow is now part of the MVP. This roadmap phase covers only the broader attendance dashboard and policy work beyond that MVP:
- Owner attendance dashboard with scheduled start/end/duration, manager-confirmed attendance, lateness metrics, and absence-confirmed versus no-response views.
- Evidence-confidence display as source quality only; never a worker score, ranking, or discipline input.
- Broader delay policies, correction workflows, retention rules, and legal review.
- **Gate before building:** Belgian workplace-monitoring/data-protection review, employee notice, retention and correction process, call consent/contact hours.

## Phase 2 — Availability and schedule drafting
- Employees submit availability and date-bounded time-off requests for a planning period.
- Deterministic draft from role/skill, availability, rest/overlap and coverage rules; uncovered shifts stay visible, nothing is invented.
- Manager edits, decides every leave request explicitly, then publishes (audited). Later changes go through tracked manager actions; attendance recovery remains the urgent path.
- **Gate:** define period, deadlines, rest rules, fairness constraints, handling of incomplete submissions.

## Parked — accelerated worker pay (formerly Phase 3)
Not pursued for now: it is a different product (payroll integration, wage-payment timing law, Stripe Connect KYC, student contracts) and would change the company's risk profile. If it is ever revisited: payroll must supply validated net amounts; Stripe Billing (restaurant SaaS) stays separate from any payout rail; never market "instant salary" before Belgian legal treatment, bank timing and fees are confirmed (see SPF Emploi pages on payment dates and student contracts, and Stripe Payouts docs).
