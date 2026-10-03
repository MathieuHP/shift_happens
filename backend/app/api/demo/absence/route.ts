import { z } from "zod";

import { handleAbsenceMessage } from "@/lib/cascade/handleAbsenceMessage";
import { setDemoStateFromCascade } from "@/lib/demo/demoState";
import { simulateDemoAbsence } from "@/lib/demo/simulateDemoAbsence";
import { hasSupabaseConfig } from "@/lib/env";

const demoAbsenceSchema = z.object({
  fromPhone: z.string().default("+15550001001"),
  body: z.string().default("I'm sick and cannot make my 8 AM shift."),
});

export async function POST(request: Request) {
  try {
    const payload = demoAbsenceSchema.parse(await request.json().catch(() => ({})));

    if (!hasSupabaseConfig()) {
      const result = simulateDemoAbsence(payload);
      setDemoStateFromCascade(result);

      return Response.json(result);
    }

    const result = await handleAbsenceMessage(payload);

    return Response.json({
      mode: "live",
      simulated: false,
      absenceCaseId: result.absenceCaseId,
      absentEmployee: result.absentEmployee.name,
      candidateCount: result.candidates.length,
      cascade: result.cascade,
    });
  } catch (error) {
    console.error("Demo absence failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
