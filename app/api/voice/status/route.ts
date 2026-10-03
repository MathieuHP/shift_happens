import { callNextCandidate } from "@/lib/cascade/callNextCandidate";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { insertEvent } from "@/lib/events/insertEvent";
import type { CallAttempt, Employee } from "@/lib/types";

const NO_ANSWER_STATUSES = new Set(["busy", "failed", "no-answer", "canceled"]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  if (!attemptId) {
    return new Response("Missing attemptId", { status: 400 });
  }

  const formData = await request.formData();
  const callStatus = formData.get("CallStatus")?.toString() ?? "unknown";

  if (!NO_ANSWER_STATUSES.has(callStatus)) {
    return Response.json({ ok: true, ignored: callStatus });
  }

  const supabase = createSupabaseServiceClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("id", attemptId)
    .single<CallAttempt>();

  if (attemptError || attempt.status === "accepted" || attempt.status === "declined") {
    return Response.json({ ok: true, ignored: callStatus });
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", attempt.employee_id)
    .single<Employee>();

  const status = callStatus === "failed" ? "failed" : "no_answer";
  const { error: updateError } = await supabase
    .from("call_attempts")
    .update({ status })
    .eq("id", attemptId);

  if (updateError) {
    throw updateError;
  }

  await insertEvent(supabase, {
    absenceCaseId: attempt.absence_case_id,
    type: status === "failed" ? "call_failed" : "call_no_answer",
    message: `${employee?.name ?? "Candidate"} did not accept the call.`,
    payload: { attemptId, callStatus },
  });

  await callNextCandidate(attempt.absence_case_id);

  return Response.json({ ok: true });
}
