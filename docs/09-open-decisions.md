# Decision log — backend review (2026-10-03)

Result of reviewing the backend against these docs. Each row: the question, what we decided, and what it changes. **Status** is `decided`, `assumed` (our reading of an answer, to confirm) or `open`.

| # | Question | Decision | Status | Consequence |
|---|---|---|---|---|
| 1 | Autopilot or manager confirmation of the replacement | **Autopilot by default; the manager can switch on "confirm every replacement"** (setting `manager_approval_required`, a toggle in the manager screen). When on, an acceptance stays `pending_approval` until the manager confirms or rejects. | decided | Implemented: `backend/lib/inapp/service.ts`, `GET/PUT /api/settings`. |
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
| QR signing and venue scanner | F5 | Employee/shift binding, signing key, expiry, single-use behavior, wrong-employee rejection, scanner identity | Valid scan records check-in and invalid/replayed scans are rejected |
| Attendance scheduler | F5 | Durable `T−10` check-in opening, `T−5` recovery trigger, retry/replay behavior, timezone handling | One recovery case starts at the correct time, else labeled fixture |
| ElevenLabs outbound attendance call | F5 | Agent ID, caller ID, test-number restrictions, response intents (`on_my_way`, `absent`, `unclear`), status callbacks, `call_recording_enabled=false` honored | One attendance call completes, else mock voice |
| ElevenLabs outbound replacement offer | F5 | `agent_phone_number_id` lookup, recipient binding, offer context, timeout, callback authentication, test numbers, recording/transcript retention settings, complete 3-candidate sequence | Still unverified against the live ElevenLabs/Twilio account; current branch has a simulated default and an optional live adapter. Configure the agent/tool/webhook and run a test-number call before claiming live readiness. |
| Stripe | F6 | Test account, price ID, Checkout, webhook forwarding + signature verification, Customer Portal | Checkout + signed webhook work, else signed fixture |

## Decisions (current default in bold)
- **Attendance response vocabulary** is limited to `on_my_way`, `absent`, `no_answer`, and `unclear`; server validates. No LLM service.
- **Sequential offers**, 45 s per voice offer; parallel top-N later.
- **Check-in timing:** opens at `T−10`; recovery evaluation is at `T−5` in the restaurant timezone.
- **Assignment mode:** manager-configurable automatic assignment or manual confirmation; manual is the default for the demo.
- **Binary entitlement.**
- **Demo language:** pick one (default French, matching the mockup) before the F5 voice spike.
- **Manager notification channel:** dashboard + stub in MVP; real SMS/email after the hackathon.
- **Minimum rest hours default 11:** placeholder; local rules to be confirmed before any pilot.
- **Pricing (€99–€299/month):** unvalidated.

## Mock rule
If a provider is unusable after its 1-hour spike, mock that adapter and keep the rest of the loop real. Never mock eligibility, manager controls, entitlement logic, validation or state transitions.

## Before any pilot
Contact consent and hours; recording/transcript notice, lawful basis and retention; labor rules; support ownership; real notification channel.

## Implementation status (branch `backend-inapp-flow`)
- Done: 11 h rest rule both directions; roles `salle/cuisine/bar`; contact consent; in-app report (absence/delay, idempotent); manager "find replacement"; in-app offers with single winner and ignored duplicates; "no replacement" alert; approval mode; `DEMO_SECRET` guard on `/api/demo/*`; front buttons and manager panel.
- State lives **in memory** in the backend process (resets on restart; `POST /api/demo/reset` resets on demand). A Supabase version is not written yet; the legacy SMS/voice routes and `schema.sql` tables are untouched except roles and consent.
- Stripe (see `docs/stripe-setup.md`): subscription (Checkout, signed webhook, binary entitlement, optional `REQUIRE_SUBSCRIPTION` gate, portal) and shift payouts (Connect v2 `recipient` accounts, `transfers.create` with idempotency). Payouts are TEST MODE ONLY and not legal payroll; hosted onboarding needs a Stripe sandbox. A voice-agent master prompt for the colleague is in `docs/master-prompt-voice-agent.md`.
- Not done: availability rule, "least recent offer" ordering (still `priority`), Stripe entitlement check, real authentication (anyone can call the in-app routes).
