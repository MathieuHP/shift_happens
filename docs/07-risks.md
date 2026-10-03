# Privacy, safety and operational risks (MVP)

| Risk | Mitigation |
|---|---|
| Forged or reused QR code | Sign tokens server-side, bind them to one employee and shift, enforce expiry and single-use keys, and audit rejected scans. |
| Wrong employee scans for a shift | Scanner validation compares token employee, assigned employee, shift, location/window, and current assignment before recording check-in. |
| Missed or delayed attendance event | Use explicit `T−10` and `T−5` scheduler checkpoints, durable jobs, idempotency keys, and a visible manager recovery status. |
| Duplicate recovery trigger | Unique recovery key per shift and checkpoint; compare-and-set before starting any call. |
| Voice agent misunderstands attendance response | Allow only `on_my_way`, `absent`, `no_answer`, or `unclear`; unclear never means present or absent without the configured fallback and manager alert. |
| Agent tool overreach | `voice.*` tools only submit the response for a bound call; server controls recipients, eligibility, assignment mode, and state transitions. |
| Ineligible replacement contacted | Eligibility is deterministic server code; manager approves; reason codes visible; consent and contact window checked before every call. |
| Two people assigned one shift | Transactional single-winner acceptance and confirmation; close remaining offers. |
| Missing attendance case is missed because nobody watches the dashboard | Recovery deadline, notification on creation, reminder if unresolved, and "past deadline" flag. |
| Long sequential list is too slow | 45 s per-offer timeout; manager can reorder/trim; parallel top-N offers is a documented later option. |
| Sensitive data stored | No reason asked; no raw transcript/audio; short note only if consented. Confirm provider-side retention in spike. |
| ElevenLabs/Twilio outage or misrouting | Test calls before demo; keep case; alert manager; manual contact action; demo inbox fallback. |
| Call linked to the wrong shift/employee/candidate | Correlate `CallSid`, `conversation_id`, purpose, recipient, and server-side context; reject mismatches. |
| Outbound retry duplicates a call | Persist `CallAttempt` + idempotency key first; on timeout reconcile by returned IDs before retrying; one active attempt per case. |
| Outbound contact breaches consent/hours | Check consent and contact window before dialing; test numbers only. |
| Stripe replay / duplicate / spoof | Signature check, unique event ID, idempotent handler, reconcile authoritative state. |
| Wrong entitlement | Derive from persisted subscription; never from redirect; binary rule; billing never changes cases. |
| Provider webhook spoof | Verify signatures/auth where supported; dedupe; unsupported verification stays mocked and labeled until resolved. |
| Automatic assignment surprises a manager | Show assignment mode prominently, make it manager-configurable, audit changes, and hold acceptance in manual mode. |
| Unfair automated decisions | No ranking by attendance, discipline, protected traits or inferred reliability. |
| Legal differences by region | No compliance claim; production needs local labor and privacy review. Recording off. |
| Provider outage leaves shift uncovered | Case stays open; manager action visible; never claim coverage. |

## Human control
The server controls outreach and eligibility. The manager configures automatic versus manual assignment; voice cannot alter assignment mode, eligibility, or shift state.

## Demo safeguards
Fictional roster, test numbers, Stripe test mode, no real employee contact. Every mock is labeled; real validations and state transitions stay on.
