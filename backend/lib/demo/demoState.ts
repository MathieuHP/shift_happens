import type { simulateDemoAbsence } from "@/lib/demo/simulateDemoAbsence";

type DemoAbsenceResult = ReturnType<typeof simulateDemoAbsence>;

export type DemoDashboardState = {
  mode: "simulated" | "live";
  simulated: boolean;
  status: "idle" | "calling" | "resolved";
  updatedAt: string;
  managerNotification: string | null;
  roster: Array<{
    id: string;
    name: string;
    role: string;
    phone: string;
    status: "scheduled" | "available" | "absent" | "called" | "declined" | "accepted";
  }>;
  schedule: Array<{
    id: string;
    role: string;
    startsAt: string;
    endsAt: string;
    status: "scheduled" | "vacant" | "covered";
    employeeName: string | null;
    replacementFor: string | null;
  }>;
  currentCase: null | {
    id: string;
    absentEmployee: string;
    replacementEmployee: string | null;
    shiftRole: string;
    startsAt: string;
    endsAt: string;
    candidateCount: number;
    cascadeStatus: string;
  };
  timeline: Array<{
    type: string;
    message: string;
  }>;
};

const GLOBAL_KEY = "__shiftsaver_demo_state__";

function initialState(): DemoDashboardState {
  return {
    mode: "simulated",
    simulated: true,
    status: "idle",
    updatedAt: new Date().toISOString(),
    managerNotification: null,
    roster: [
      {
        id: "demo-paul-martin",
        name: "Paul Martin",
        role: "server",
        phone: "+15550001001",
        status: "scheduled",
      },
      {
        id: "demo-sarah-lee",
        name: "Sarah Lee",
        role: "server",
        phone: "+15550001002",
        status: "available",
      },
      {
        id: "demo-thomas-reed",
        name: "Thomas Reed",
        role: "server",
        phone: "+15550001003",
        status: "available",
      },
    ],
    schedule: [
      {
        id: "demo-shift-8am",
        role: "server",
        startsAt: "08:00",
        endsAt: "16:00",
        status: "scheduled",
        employeeName: "Paul Martin",
        replacementFor: null,
      },
    ],
    currentCase: null,
    timeline: [],
  };
}

function getStore() {
  const store = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: DemoDashboardState;
  };

  if (!store[GLOBAL_KEY]) {
    store[GLOBAL_KEY] = initialState();
  }

  return store;
}

export function getDemoState() {
  return getStore()[GLOBAL_KEY] ?? initialState();
}

export function resetDemoState() {
  const state = initialState();
  getStore()[GLOBAL_KEY] = state;
  return state;
}

export function setDemoStateFromAbsence(result: DemoAbsenceResult) {
  const state: DemoDashboardState = {
    mode: result.mode,
    simulated: result.simulated,
    status: "resolved",
    updatedAt: new Date().toISOString(),
    managerNotification: result.managerNotification,
    roster: [
      {
        id: "demo-paul-martin",
        name: "Paul Martin",
        role: "server",
        phone: "+15550001001",
        status: "absent",
      },
      {
        id: "demo-sarah-lee",
        name: "Sarah Lee",
        role: "server",
        phone: "+15550001002",
        status: "declined",
      },
      {
        id: "demo-thomas-reed",
        name: "Thomas Reed",
        role: "server",
        phone: "+15550001003",
        status: "accepted",
      },
    ],
    schedule: [
      {
        id: "demo-shift-8am",
        role: result.shift.role,
        startsAt: result.shift.startsAt,
        endsAt: result.shift.endsAt,
        status: "covered",
        employeeName: "Thomas Reed",
        replacementFor: result.absentEmployee,
      },
    ],
    currentCase: {
      id: result.absenceCaseId,
      absentEmployee: result.absentEmployee,
      replacementEmployee: "Thomas Reed",
      shiftRole: result.shift.role,
      startsAt: result.shift.startsAt,
      endsAt: result.shift.endsAt,
      candidateCount: result.candidateCount,
      cascadeStatus: result.cascade.status,
    },
    timeline: result.timeline,
  };

  getStore()[GLOBAL_KEY] = state;
  return state;
}
