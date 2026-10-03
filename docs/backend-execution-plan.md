# Backend Execution Plan

This adapts the `kash-branch` planning docs to the current `backend-shiftsaver` codebase.

## Review Decision

The kash docs are good as product and safety planning, but they should not be merged directly because `kash-branch` is docs-only and has independent history. A direct merge would remove the working `backend/` and `frontend/` compartments.

## Adopt Now

- Keep deterministic eligibility in application code.
- Add idempotency and audit coverage around state-changing webhook flows.
- Track provider IDs for voice interactions and call attempts.
- Keep billing/entitlement separate from shift workflow state.
- Preserve a clearly labeled demo fallback when a provider boundary is blocked.
- Keep raw audio/transcripts out of app storage by default.

## Adapt For The Hackathon Demo

The MVP demo promise is outbound attendance recovery: a missing employee-specific check-in triggers a call to the scheduled employee, then a deterministic replacement cascade. The manager controls whether the first replacement acceptance is assigned automatically or held for confirmation.

For the prototype, use a seeded restaurant policy flag:

- `auto_assign_replacement=false` by default for the demo.
- Keep automatic assignment available as the alternate manager setting.
- Keep audit events, deterministic eligibility and single-winner assignment in both modes.

## Backend Build Order

1. Add restaurant account and entitlement tables.
2. Add idempotency keys and provider event dedupe tables.
3. Add audit events for every state transition.
4. Add a small `VoiceInteraction` record for Twilio/voice provider correlation.
5. Add employee-specific signed QR check-in and venue/manager scanner validation.
6. Add the `T−10` check-in opening and `T−5` recovery trigger with idempotency.
7. Add the scheduled-employee attendance call and sequential replacement cascade.
8. Add Stripe test checkout and webhook entitlement path.
9. Harden the recovery/cascade state machine around duplicate provider events and race conditions.
10. Add route-level webhook signature verification where provider setup allows it.

## Do Not Build Yet

- Broader attendance analytics and evidence-confidence dashboards.
- Availability planning and schedule drafting.
- Payroll or worker payout flows.
- Legal-policy enforcement beyond the documented MVP attendance controls.
