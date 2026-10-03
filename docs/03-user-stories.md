# User stories and acceptance criteria

## Employee reports a callout by voice
As an employee, I want to explain naturally that I cannot work a shift so the manager can find cover quickly.

**Acceptance:** Employee calls the restaurant's Twilio number connected to the ElevenLabs Conversational AI agent. ElevenLabs greets/discloses automation and captures speech; Ingram returns typed intent; application validates employee, intent and shift against records; voice reads details back and permits correction; one pending case is created with a reference. Twilio `CallSid` and ElevenLabs `conversation_id` are correlated. No schedule change occurs. Ambiguity or low confidence triggers clarification/review.

## Manager reviews and starts a search
As a manager, I want explainable eligibility and control over who is contacted.

**Acceptance:** Dashboard shows shift, candidates, rule reasons and warnings. Eligibility was computed in application code. Only authenticated manager can authorize or reject outreach.

## Replacement accepts an offer
As an eligible employee, I want a concise voice or simulated offer and a clear deadline.

**Acceptance:** Offer includes date, start/end, role and response deadline. Application requests one outbound call through ElevenLabs Conversational AI's Twilio integration; the agent presents the offer and captures yes/no. Acceptance is recorded once and held in `accepted_pending_manager`; it does not assign the shift. App stores the returned ElevenLabs `conversation_id` and Twilio `CallSid`.

## Manager confirms replacement
As a manager, I want to confirm one replacement and close the case.

**Acceptance:** Confirmation atomically assigns one employee, closes other offers, records actor/time and notifies both parties. Repeated confirmation is rejected safely.

## Restaurant subscribes
As a restaurant manager, I want to activate ShiftVoice through a simple subscription.

**Acceptance:** Test checkout creates/links a restaurant account to Stripe customer/subscription IDs. A verified webhook updates billing state idempotently. Dashboard displays entitlement and subscription status. Billing events do not alter shift cases or assignments.

## Employee requests future time off
The request is captured and recorded as pending only; no approval or schedule change is implied.

## Roadmap — employee reports expected lateness
As an employee who expects to arrive late, I want to report the affected shift and estimated arrival time before I arrive.

**Acceptance:** App identifies the employee and upcoming shift, captures optional ETA, confirms the report, and alerts the manager. It does not label the employee absent or start replacement calls. The report suppresses the T−5 check call; if the ETA passes without check-in, manager receives an alert (automatic re-escalation is off by default).

**Updated automation rule:** A delay notice received before the T−5 call suppresses the automated check-in call. The notice is shown to the manager with its ETA; it does not by itself start replacement outreach.

## Roadmap — employee checks in by QR
As an employee arriving at work, I want to scan the restaurant's QR code so the actual check-in time is recorded.

**Acceptance:** Server validates employee, location, shift window and duplicate scans. The event records scan time; it is not treated as advance notice, proof of hours worked, or an automatic disciplinary finding. Late threshold and grace period are configured by the restaurant and shown to managers.

## Roadmap — system checks on-shift employee and escalates
As a restaurant manager, I want the system to check whether an employee is on the way shortly before a shift and start pre-authorized replacement calls if needed.

**Acceptance:** Check-in opens at T−10. If the employee has not checked in or reported a delay by T−5, ElevenLabs Conversational AI calls the employee through Twilio once. “I’m on my way” or a confirmed ETA ends escalation. No answer, or “I will not come,” starts sequential Twilio calls through ElevenLabs to the manager-approved eligible list only if the restaurant enabled and authorized this policy. A replacement acceptance is held for manager confirmation. Every call is logged with both provider IDs.

## Roadmap — owner reviews presence statistics
As a restaurant owner, I want factual attendance and lateness statistics to see staffing patterns and data gaps.

**Acceptance:** Dashboard shows scheduled shift times/duration, check-in coverage, manager-confirmed attendance, late arrivals and lateness duration, with filters by date/location. Every record includes provenance confidence (e.g. verified QR, employee self-report, unresolved/no data). Check-in alone is not reported as proof of completed hours. No aggregate opaque “trust score,” predictive reliability rating, discipline recommendation or protected-trait inference is produced.

## Roadmap — manager plans a schedule from availability
As a manager, I want employees to submit availability and leave requests, then review a draft schedule.

**Acceptance:** Employees submit availability for a specific planning period. The system flags conflicts and generates a draft using deterministic role, skill, availability and rest/overlap constraints. Manager edits and publishes; time-off requests require an explicit manager decision. No schedule is published or employee assigned automatically.

## Roadmap — extra worker receives accelerated pay (Phase 3)
As an extra worker, I want access to my approved pay promptly after a completed shift.

**Acceptance:** Completed attendance is reviewed; employer/payroll process provides a validated net-pay amount and confirms the payment date/treatment. Worker sees the amount, any applicable fee and expected arrival before consenting. An authorized manager/payroll role initiates one payout. The app shows pending/paid/failed status and a payroll reference; retries do not duplicate payment. The employer remains responsible for statutory payroll documents and corrections.
