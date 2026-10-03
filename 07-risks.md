# Privacy, safety and operational risks (MVP)

| Risk | Mitigation |
|---|---|
| Wrong caller or shift | Phone mapping is a convenience, not authentication. Read-back; shift must be one the server listed for that employee; unmatched/ambiguous → manager review. |
| Caller-ID spoofing triggers a bogus case | Case is only a request; nothing happens without manager approval; case shows "caller-ID matched, not verified". |
| Voice agent misunderstands or hallucinates | Agent speaks only from tool results; read-back; no promise of approval/cover; unclear twice → callback/manager review. |
| Prompt injection in employee speech | Speech is untrusted; fixed agent policy; allowlisted narrow tools; server authorizes every call and ignores model-claimed identity. |
| Agent tool overreach | `voice.*` tools omit approval/assignment/recipient selection; manager endpoints need a separate authenticated session. |
| Ineligible replacement contacted | Eligibility is deterministic server code; manager approves; reason codes visible; consent and contact window checked before every call. |
| Two people assigned one shift | Transactional single-winner acceptance and confirmation; close remaining offers. |
| Callout is missed because nobody watches the dashboard | Case deadline, notification on creation, reminder if unapproved, "past deadline" flag. |
| Long sequential list is too slow | 45 s per-offer timeout; manager can reorder/trim; parallel top-N offers is a documented later option. |
| Sensitive data stored | No reason asked; no raw transcript/audio; short note only if consented. Confirm provider-side retention in spike. |
| ElevenLabs/Twilio outage or misrouting | Test calls before demo; keep case; alert manager; manual contact action; demo inbox fallback. |
| Call linked to the wrong shift/candidate | Correlate `CallSid`, `conversation_id`, agent/number and server-side context; reject mismatches. |
| Outbound retry duplicates a call | Persist `CallAttempt` + idempotency key first; on timeout reconcile by returned IDs before retrying; one active attempt per case. |
| Outbound contact breaches consent/hours | Check consent and contact window before dialing; test numbers only. |
| Stripe replay / duplicate / spoof | Signature check, unique event ID, idempotent handler, reconcile authoritative state. |
| Wrong entitlement | Derive from persisted subscription; never from redirect; binary rule; billing never changes cases. |
| Provider webhook spoof | Verify signatures/auth where supported; dedupe; unsupported verification stays mocked and labeled until resolved. |
| Unfair automated decisions | No ranking by attendance, discipline, protected traits or inferred reliability. |
| Legal differences by region | No compliance claim; production needs local labor and privacy review. Recording off. |
| Provider outage leaves shift uncovered | Case stays open; manager action visible; never claim coverage. |

## Human control
Manager approval is mandatory before outreach; manager confirmation before assignment. Voice cannot approve leave or alter assignment.

## Demo safeguards
Fictional roster, test numbers, Stripe test mode, no real employee contact. Every mock is labeled; real validations and state transitions stay on.
