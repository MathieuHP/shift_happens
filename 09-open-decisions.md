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
