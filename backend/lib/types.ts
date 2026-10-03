export type EmployeeRole = "salle" | "cuisine" | "bar";

export type ShiftStatus = "scheduled" | "vacant" | "covered" | "cancelled";

export type AbsenceCaseStatus =
  | "open"
  | "calling"
  | "accepted_pending_manager"
  | "resolved"
  | "unresolved";

export type CallAttemptStatus =
  | "queued"
  | "calling"
  | "accepted"
  | "declined"
  | "no_answer"
  | "failed"
  | "completed"
  | "closed";

export type EventType =
  | "absence_reported"
  | "shift_vacant"
  | "candidate_list_created"
  | "call_started"
  | "call_declined"
  | "call_no_answer"
  | "call_failed"
  | "candidate_skipped"
  | "replacement_accepted"
  | "case_resolved"
  | "case_unresolved"
  | "demo_call_skipped";

export type Employee = {
  id: string;
  restaurant_account_id: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  skills: string[];
  active: boolean;
  priority: number;
  contact_consent_at: string | null;
};

export type Shift = {
  id: string;
  restaurant_account_id: string;
  employee_id: string | null;
  role: EmployeeRole;
  skill_required: string;
  starts_at: string;
  ends_at: string;
  status: ShiftStatus;
  replacement_for_employee_id?: string | null;
  hourly_rate?: number;
};

export type AbsenceCase = {
  id: string;
  restaurant_account_id: string;
  absent_employee_id: string;
  shift_id: string;
  status: AbsenceCaseStatus;
  candidate_ids: string[];
  accepted_employee_id: string | null;
};

export type CallAttempt = {
  id: string;
  absence_case_id: string;
  employee_id: string;
  status: CallAttemptStatus;
  /** Unique per case/candidate; nullable only for attempts created by older app versions. */
  idempotency_key: string | null;
  twilio_call_sid: string | null;
  voice_provider: string;
  voice_conversation_id: string | null;
};

export type TimelineEvent = {
  id: string;
  absence_case_id: string | null;
  type: EventType;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Candidate = Employee & {
  score: number;
  reason: string;
};

export type RestaurantAccount = {
  id: string;
  name: string;
  timezone: string;
  autopilot_enabled: boolean;
  manager_confirmation_required: boolean;
  demo_seeded: boolean;
};

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type Subscription = {
  id: string;
  restaurant_account_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  last_event_id: string | null;
};

export type VoiceInteraction = {
  id: string;
  restaurant_account_id: string;
  absence_case_id: string | null;
  call_attempt_id: string | null;
  provider: "twilio" | "elevenlabs";
  direction: "inbound" | "outbound";
  twilio_call_sid: string | null;
  conversation_id: string | null;
  metadata: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  restaurant_account_id: string | null;
  absence_case_id: string | null;
  actor_type: "system" | "manager" | "employee" | "provider";
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
