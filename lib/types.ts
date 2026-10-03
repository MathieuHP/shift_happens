export type EmployeeRole = "server" | "nurse" | "cashier" | "manager";

export type ShiftStatus = "scheduled" | "vacant" | "covered" | "cancelled";

export type AbsenceCaseStatus =
  | "open"
  | "calling"
  | "resolved"
  | "unresolved";

export type CallAttemptStatus =
  | "queued"
  | "calling"
  | "accepted"
  | "declined"
  | "no_answer"
  | "failed";

export type EventType =
  | "absence_reported"
  | "shift_vacant"
  | "candidate_list_created"
  | "call_started"
  | "call_declined"
  | "call_no_answer"
  | "call_failed"
  | "replacement_accepted"
  | "case_resolved"
  | "case_unresolved"
  | "demo_call_skipped";

export type Employee = {
  id: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  skills: string[];
  active: boolean;
  priority: number;
};

export type Shift = {
  id: string;
  employee_id: string | null;
  role: EmployeeRole;
  skill_required: string;
  starts_at: string;
  ends_at: string;
  status: ShiftStatus;
};

export type AbsenceCase = {
  id: string;
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
  twilio_call_sid: string | null;
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
