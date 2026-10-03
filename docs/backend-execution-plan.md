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

The original ShiftSaver demo promise is autonomous coverage: “The manager sleeps, the AI finds the replacement.” The kash docs add manager approval before outreach and manager confirmation before assignment. That is safer for production, but it weakens the live hackathon wow effect.

For the prototype, use a seeded restaurant policy flag:

- `autopilot_enabled=true` for the live demo path.
- `manager_confirmation_required=false` for the live demo path.
- Keep audit events, deterministic eligibility and single-winner assignment.
- Keep the safer manager-gated workflow documented as production mode.

## Backend Build Order

1. Add restaurant account and entitlement tables.
2. Add idempotency keys and provider event dedupe tables.
3. Add audit events for every state transition.
4. Add a small `VoiceInteraction` record for Twilio/voice provider correlation.
5. Add Stripe test checkout and webhook entitlement path.
6. Harden the absence/cascade state machine around duplicate webhooks and race conditions.
7. Add demo policy switches for `autopilot_enabled` and `manager_confirmation_required`.
8. Add route-level webhook signature verification where provider setup allows it.

## Do Not Build Yet

- QR check-in.
- T-minus-5 lateness escalation.
- Availability planning and schedule drafting.
- Payroll or worker payout flows.
- ElevenLabs migration unless Twilio direct voice becomes a blocker or the team explicitly chooses ElevenLabs.
