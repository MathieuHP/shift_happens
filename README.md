# ShiftVoice — hackathon implementation pack

Voice-first restaurant callout and replacement coordination:

`Employee reports an absence → shift identified → manager approves outreach → eligible candidates contacted one at a time → acceptance held → manager confirms replacement.`

## Stack
- **ElevenLabs Conversational AI + Twilio** (native integration): inbound and outbound voice. The agent collects structured slots through narrow tool calls; it has no authority.
- **ShiftVoice application code**: authoritative for identity, shift matching, eligibility, permissions, state transitions and assignment.
- **Stripe (test mode)**: restaurant subscription; entitlement derived from verified webhooks.
- No LLM sits between the agent and the domain: understanding happens inside the ElevenLabs agent, and every tool argument is validated server-side. (Ingram was removed from the project.)

## How we build: features, one small slice at a time
`02-mvp-requirements.md` defines an ordered ladder F0 → F9. Each feature is demoable on its own, has a definition of done, and says what is real vs mocked. Work on one feature at a time; do not start the next until the current one passes its acceptance in `03-user-stories.md`.

Core loop first with mocked providers (F0–F4), then swap real providers in one at a time (F5–F8).

## Documents
1. [Product brief](01-product-brief.md)
2. [Feature ladder and requirements](02-mvp-requirements.md)
3. [Acceptance criteria per feature](03-user-stories.md)
4. [Workflows and state machines](04-workflows.md)
5. [Architecture and tool boundaries](05-architecture.md)
6. [Data model and API](06-data-model-api.md)
7. [Risks](07-risks.md)
8. [Test plan and demo narrative](08-test-plan.md)
9. [Provider spikes and open decisions](09-open-decisions.md)
- [ROADMAP.md](ROADMAP.md) — everything after the hackathon.
- `App shifts horeca — écrans.html` — UI mockup.
