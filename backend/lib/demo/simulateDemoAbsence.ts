export function simulateDemoAbsence(input: { fromPhone: string; body: string }) {
  const absenceCaseId = "demo-case-local";

  return {
    mode: "simulated" as const,
    simulated: true,
    reason: "Supabase environment is not configured, so ShiftSaver used the local demo simulator.",
    absenceCaseId,
    absentEmployee: "Paul Martin",
    shift: {
      role: "server",
      startsAt: "08:00",
      endsAt: "16:00",
    },
    inbound: {
      fromPhone: input.fromPhone,
      body: input.body,
    },
    candidateCount: 2,
    replacementEmployee: "Thomas Reed",
    trigger: "sick_sms" as const,
    cascade: {
      status: "resolved",
      attempted: true,
      acceptedEmployeeId: "demo-thomas-reed",
    },
    timeline: [
      {
        type: "absence_reported",
        message: "Paul Martin reported he cannot work the 8:00 server shift.",
      },
      {
        type: "shift_vacant",
        message: "The server shift is now vacant.",
      },
      {
        type: "candidate_list_created",
        message: "Found 2 eligible replacement candidates.",
      },
      {
        type: "call_started",
        message: "Calling Sarah Lee for the vacant shift.",
      },
      {
        type: "call_declined",
        message: "Sarah Lee declined the shift.",
      },
      {
        type: "call_started",
        message: "Calling Thomas Reed for the vacant shift.",
      },
      {
        type: "replacement_accepted",
        message: "Thomas Reed accepted the shift.",
      },
      {
        type: "case_resolved",
        message: "The manager sleeps. ShiftSaver handled it.",
      },
    ],
    managerNotification:
      "Paul called in sick. I handled it. Thomas Reed will cover his 8:00 shift.",
  };
}
