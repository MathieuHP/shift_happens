# ShiftVoice — hackathon implementation pack

Voice-first restaurant callout and replacement coordination. Narrow workflow: employee reports absence → system identifies shift → manager approves outreach → eligible candidates are contacted → acceptance is held → manager confirms replacement.

## What changed
ElevenLabs Conversational AI handles voice, connected to the restaurant's Twilio number through its native Twilio integration. Ingram handles bounded structured inference, and Stripe test-mode subscription is part of the visible onboarding/demo. Billing and shift operations remain separate bounded contexts. Application code remains authoritative for eligibility, permissions and assignment.

## Product roadmap beyond the hackathon
- **Phase 1:** employee delay notice and check-in; if neither exists by T−5 (check-in opens at T−10), ElevenLabs calls the scheduled employee once. A confirmation stops escalation; no answer/absence starts sequential calls to eligible replacements only under an explicitly preauthorized restaurant policy. Manager still confirms the final assignment.
- **Phase 1 analytics:** owner sees scheduled shift times/duration, attendance confirmation, presence, lateness and evidence confidence by source. Confidence is data quality, never employee trustworthiness.
- **Phase 2:** collect availability and time-off requests, create an unpublished schedule draft, then require manager review and explicit publication.
- **Phase 3:** offer an optional accelerated worker payout only after payroll has validated the net amount and employer authorization. Keep this separate from restaurant SaaS subscriptions; Stripe Connect eligibility and Belgian payroll/legal treatment must be verified.
- QR check-in cannot warn before arrival. It complements the delay button. None of the roadmap features is part of the current hackathon MVP.

## Documents
1. [Product brief](01-product-brief.md)
2. [MVP requirements](02-mvp-requirements.md)
3. [User stories](03-user-stories.md)
4. [Workflows](04-workflows.md)
5. [Architecture and tool boundaries](05-architecture.md)
6. [Data model and API](06-data-model-api.md)
7. [Risks](07-risks.md)
8. [Test plan and demo narrative](08-test-plan.md)
9. [Open decisions and priorities](09-open-decisions.md)

Roadmap requirements, workflows, models, risks and tests are incorporated in documents 01–09 and explicitly marked as later phases.

## Build order
1. Seed restaurant, employees, shifts and a configured demo plan; implement account/subscription entitlement records.
2. Build Stripe test checkout + webhook signature/dedupe path; show active entitlement in dashboard.
3. Implement deterministic eligibility, state machine, audit log and manager approval/confirmation.
4. Wire Ingram extraction behind schema validation; test ambiguity and safe fallback.
5. Connect Twilio number to ElevenLabs Conversational AI; wire inbound voice tools and read-back; test pending-only creation and provider-ID correlation.
6. Add outbound voice offer if feasible; otherwise use labeled demo inbox/mock.
7. Run end-to-end checklist and rehearse the two-minute narrative.

Provider endpoint references are recorded in the architecture document. Account setup, phone-number provisioning, credentials, callback security and provider-specific capabilities not yet confirmed are marked **TO VERIFY**.
