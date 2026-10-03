export function simulateDemoNoShow() {
  const absenceCaseId = "demo-no-show-local";

  return {
    mode: "simulated" as const,
    simulated: true,
    reason: "No Supabase/Twilio setup required: ShiftSaver used the local no-show simulator.",
    trigger: "no_show" as const,
    absenceCaseId,
    absentEmployee: "Jade Dubois",
    replacementEmployee: "Sacha Noel",
    shift: {
      role: "bar",
      startsAt: "19:00",
      endsAt: "23:00",
    },
    inbound: {
      fromPhone: null,
      body: "No check-in detected five minutes before shift start.",
    },
    candidateCount: 2,
    cascade: {
      status: "resolved",
      attempted: true,
      acceptedEmployeeId: "demo-sacha-noel",
    },
    roster: [
      {
        id: "demo-jade-dubois",
        name: "Jade Dubois",
        role: "bar",
        phone: "+15550001006",
        status: "absent" as const,
      },
      {
        id: "demo-sacha-noel",
        name: "Sacha Noel",
        role: "bar",
        phone: "+15550001007",
        status: "accepted" as const,
      },
      {
        id: "demo-eli-moreau",
        name: "Eli Moreau",
        role: "server",
        phone: "+15550001008",
        status: "available" as const,
      },
    ],
    timeline: [
      {
        type: "checkin_window_opened",
        message: "Check-in opened 10 minutes before Jade's bar shift.",
      },
      {
        type: "no_checkin_detected",
        message: "No check-in or delay notice was received by T-5.",
      },
      {
        type: "employee_call_started",
        message: "Calling Jade once to ask if she is on the way.",
      },
      {
        type: "employee_no_answer",
        message: "Jade did not answer. ShiftSaver starts the pre-authorized replacement cascade.",
      },
      {
        type: "shift_vacant",
        message: "The 19:00 bar shift is now considered uncovered.",
      },
      {
        type: "candidate_list_created",
        message: "Found 2 eligible replacement candidates for the bar shift.",
      },
      {
        type: "call_started",
        message: "Calling Sacha Noel for the open bar shift.",
      },
      {
        type: "replacement_accepted",
        message: "Sacha Noel accepted the shift.",
      },
      {
        type: "case_resolved",
        message: "No-show handled automatically. Sacha Noel will cover the bar shift.",
      },
    ],
    managerNotification:
      "Jade did not check in or answer. I handled it. Sacha Noel will cover the 19:00 bar shift.",
  };
}
