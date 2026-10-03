# Decisions to validate before development

## First 30 minutes
1. **ElevenLabs + Twilio:** provision the Twilio phone number, connect/import it to the intended ElevenLabs Conversational AI agent, verify inbound routing and outbound endpoint access, and confirm agent/phone-number IDs, caller ID, supported language and test-number restrictions. API route is documented; account setup/credentials/region remain **TO VERIFY**.
2. **Ingram:** available inference tools/model identifiers, request interface, strict JSON/schema support, trace IDs, timeout/rate limits — **TO VERIFY**.
3. **Stripe:** provided tools/SDK access, test account, webhook forwarding/signature-verification path, configured plan/price ID and available Checkout/Portal features — **TO VERIFY**.
4. Choose one demo language and seeded restaurant; web manager dashboard; seeded schedule; outbound voice if it can be wired quickly, else simulated inbox.
5. Agree the subscription entitlement demo behavior: active/trialing enabled; canceled disabled; past_due read-only or disabled (default: read-only dashboard, no new intake).

## Prototype priority labels
- **Must demo:** Stripe test checkout/webhook entitlement; one Ingram extraction to schema with validation; one inbound Twilio → ElevenLabs voice intake/read-back; manager approval; deterministic eligibility; final manager confirmation.
- **Should demo:** outbound call through ElevenLabs' Twilio endpoint for decline/accept and Customer Portal.
- **Mock if blocked:** Twilio number provisioning/call, candidate outbound call, Stripe webhook transport, Ingram network adapter. Keep actual internal schema checks, entitlement service and state machine; label mock.
- **Post-hackathon:** production subscription plans/usage billing, live scheduling vendor integration, automated candidate prioritization, multi-location/multi-tenant hardening, legal pilot review.

## Roadmap sequencing decisions
- **Phase 1: lateness/escalation.** Build employee delay button and check-in first, then one T−5 employee call and configured sequential coverage escalation. Replacement outreach automation is off by default and requires owner/manager authorization of call timing, contact window, candidate list/rules and fallback. Final shift assignment still requires manager confirmation.
- **Phase 2: planning.** Availability collection and explicit time-off requests → deterministic draft schedule → manager edits and publication. Do not attempt unconstrained automatic scheduling before rules, labor constraints and correction handling are specified.
- **QR design:** rotating/signed vs static code, network/offline behavior, anti-replay, location scoping and retention — **TO VERIFY**.
- **Late threshold:** restaurant-configurable grace period, notification recipients and correction process. No disciplinary use without separate policy/legal review.
- **Call policy:** settle answer timeout, supported languages, voicemail behavior, what counts as a clear “on my way” response, missed ETA handling, replacement-call timeout and opt-out/contact consent before deployment. Employee check-in call is one attempt; unanswered replacement calls advance sequentially.
- **Attendance confidence:** use evidence provenance only (verified QR/app, employee report, manager correction, unknown). Do not create a personal trust score or reliability ranking.
- **Metrics access:** define manager/owner roles, retention, employee notice, correction process and minimum cohort sizes before pilot; privacy impact/legal review may be needed.
- **Planning rules:** period, availability deadlines, rest/overlap rules, skills, fairness constraints and treatment of incomplete submissions must be defined before Phase 2.
- **Phase 3 — worker pay:** determine whether the feature is an employer-paid wage advance, accelerated payroll settlement, or another legally reviewed product. Validate wage-period/payment-date rules, student contract terms, applicable restaurant joint committee/collective agreements, payroll reporting and consent/fee treatment before pilot.
- Confirm which payroll provider can return validated payable net amounts and reconcile corrections, cancellations, tax/social deductions and final payslips.
- Verify Stripe Connect platform availability, Belgium connected-account eligibility, KYC requirements, permitted transfer/payout model, instant payout support and exact arrival times/fees. **TO VERIFY**; standard Stripe payouts are not necessarily immediate.
- Do not build real movement of worker funds during the hackathon. Demo a simulated payout ledger or Stripe test-mode flow only if the supplied hackathon tools explicitly support it.

## Reference checks (Belgium / Stripe)
- SPF Emploi, [Époque et date de paiement](https://emploi.belgique.be/fr/themes/remuneration/protection-de-la-remuneration/epoque-et-date-de-paiement): regular payment intervals and applicable dates are governed by law, collective agreement or work rules; contract termination has separate settlement rules.
- SPF Emploi, [Contrat d’occupation d’étudiants](https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-doccupation-etudiants-0): student employment contracts include the time of wage payment and the wage-protection law applies.
- Stripe, [Payouts](https://docs.stripe.com/payouts): payout timing depends on country, settlement, schedule and eligibility; payout initiation does not ensure immediate bank availability.
- Stripe Connect Instant Payout availability, worker account eligibility and platform responsibility in Belgium remain **TO VERIFY** for this use case.

## Validate before pilot
Consent/contact hours; recording/transcription notice, lawful basis, retention/deletion; labor rules; scheduling API permissions; pricing hypothesis (€99–€299/month unvalidated); reliability/support ownership.

## Cut rule
If a provider boundary is not usable after 30 minutes, mock that boundary and continue the same end-to-end application workflow. Do not mock deterministic eligibility, manager controls, billing entitlement logic, schema validation or state transitions.
