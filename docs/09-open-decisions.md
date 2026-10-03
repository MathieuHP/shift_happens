# Decision log — backend review (2026-10-03)

Result of reviewing the backend against these docs. Each row: the question, what we decided, and what it changes. **Status** is `decided`, `assumed` (our reading of an answer, to confirm) or `open`.

| # | Question | Decision | Status | Consequence |
|---|---|---|---|---|
| 1 | Autopilot or manager confirmation of the replacement | Recommended: autopilot for the demo, but make the code read `manager_confirmation_required` so the safe mode really exists (acceptance stays `accepted_pending_manager` until confirmed). Otherwise delete both flags. | open | Needs the whole team. Default until decided: autopilot. |
| 2 | Nobody accepts | Manager sees a clear "no replacement found" alert; case becomes `unresolved` and is flagged in the dashboard | decided | Dashboard alert, no silent state. |
| 3 | Minimum rest between shifts | 11 h, stored as a restaurant parameter | assumed (read "on attend 11h" as "we use 11 h") | Rule must be checked in both directions (see bug 1). Validate against Belgian rules before any pilot. |
| 4 | Entry channel (SMS / inbound call) | **Everything stays in the app.** No SMS, no phone calls for the hackathon build. | decided | Twilio/ElevenLabs code is out of the demo path. |
| 5 | Message that is not an absence | No free-text parsing. The employee uses an explicit **button: "Retard" or "Absence"** on a chosen shift. | decided | Removes the "late message vacates my shift" bug by design. |
| 6 | Offer timeout | Offers are in-app: the replacement sees them in "Shifts ouverts" and accepts or refuses there. No call timeout, no cron. An offer stays valid until the shift starts. | decided | Replaces the 45 s voice timeout. |
| 7 | Availability and contact consent | Add consent now (a field); availability table after the demo | decided | Eligibility rule 6 now, rule 3 later. |
| 8 | Role vocabulary | Schema roles become `salle` / `cuisine` / `bar` | decided | Migration touches seed and tests. |
| 9 | Security | Protect `/api/demo/*` with a secret once the backend is online. Twilio signature is no longer needed while there is no Twilio. | decided | Add `DEMO_SECRET` check. |
| 10 | Who builds it | Claude does front and back on a new branch (`backend-inapp-flow`), with tests, then a PR | decided | |

## New flow (replaces SMS/voice for the hackathon)
1. Employee opens the app, picks a shift, taps **Absence** or **Retard** (optional ETA). One report per employee and shift (idempotent).
2. Absence: the case is created and the manager sees it. The manager taps **Trouver un remplaçant** (same button as the roadmap lateness flow); the server computes eligible candidates (deterministic, 11 h rest in both directions, role and skills, consent) and creates in-app offers.
3. Eligible extras see the offer under "Shifts ouverts". First valid acceptance wins (conditional update, one winner); late or duplicate acceptances are ignored.
4. No candidate, or all refused → manager alert. Lateness: manager is notified only, no outreach.
5. Whether acceptance assigns the shift directly or waits for the manager depends on decision 1.

Docs 04 (workflows) and 05 (architecture) still describe voice intake and calls: treat those parts as post-hackathon until they are rewritten.

---

# Provider spikes and open decisions

"TO VERIFY" lives here and nowhere else. Each spike is time-boxed to 1 hour and ends with a written result (works / mock). Run the spike for a feature just before building it, not all at once.

## Spikes
| Spike | Feature | Verify | Exit |
|---|---|---|---|
| ElevenLabs + Twilio inbound | F5 | Provision Twilio number, import to agent, inbound routing, supported language, test-number restrictions, region | Real call reaches agent, else mock voice |
| Agent webhook tools | F5 | Tool schema, how the agent authenticates to our API (header/secret/signature), passing caller number and `conversation_id` to the tool, provider-side transcript/audio retention can be switched off | Server can trust call context, else mock |
| ElevenLabs outbound | F7 | `agent_phone_number_id`, caller ID, outbound to test numbers, call status callbacks, `call_recording_enabled=false` honored | One outbound call completes, else demo inbox |
| Stripe | F6 | Test account, price ID, Checkout, webhook forwarding + signature verification, Customer Portal | Checkout + signed webhook work, else signed fixture |

## Decisions (current default in bold)
- **Understanding lives in the ElevenLabs agent** (structured tool arguments); server validates. No LLM service. Revisit only if a spike shows the agent cannot reliably choose among listed shifts.
- **Sequential offers**, 45 s per voice offer; parallel top-N later.
- **Binary entitlement.**
- **Demo language:** pick one (default French, matching the mockup) before the F5 spike.
- **Manager notification channel:** dashboard + stub in MVP; real SMS/email after the hackathon.
- **Minimum rest hours default 11:** placeholder; local rules to be confirmed before any pilot.
- **Pricing (€99–€299/month):** unvalidated.

## Mock rule
If a provider is unusable after its 1-hour spike, mock that adapter and keep the rest of the loop real. Never mock eligibility, manager controls, entitlement logic, validation or state transitions.

## Before any pilot
Contact consent and hours; recording/transcript notice, lawful basis and retention; labor rules; support ownership; real notification channel.
