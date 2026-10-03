# Provider spikes and open decisions

"TO VERIFY" lives here and nowhere else. Each spike is time-boxed to 1 hour and ends with a written result (works / mock). Run the spike for a feature just before building it, not all at once.

## Spikes
| Spike | Feature | Verify | Exit |
|---|---|---|---|
| QR signing and venue scanner | F5 | Employee/shift binding, signing key, expiry, single-use behavior, wrong-employee rejection, scanner identity | Valid scan records check-in and invalid/replayed scans are rejected |
| Attendance scheduler | F5 | Durable `T−10` check-in opening, `T−5` recovery trigger, retry/replay behavior, timezone handling | One recovery case starts at the correct time, else labeled fixture |
| ElevenLabs outbound attendance call | F5 | Agent ID, caller ID, test-number restrictions, response intents (`on_my_way`, `absent`, `unclear`), status callbacks, `call_recording_enabled=false` honored | One attendance call completes, else mock voice |
| ElevenLabs outbound replacement offer | F5 | `agent_phone_number_id`, recipient binding, offer context, timeout, callback authentication, test numbers | One replacement offer completes, else demo inbox |
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
