import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AbsenceCase, CallAttempt, Employee, Shift } from "@/lib/types";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  if (!attemptId) {
    return new Response("Missing attemptId", { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("id", attemptId)
    .single<CallAttempt>();

  if (attemptError) {
    return new Response("Attempt not found", { status: 404 });
  }

  const { data: absenceCase, error: caseError } = await supabase
    .from("absence_cases")
    .select("*")
    .eq("id", attempt.absence_case_id)
    .single<AbsenceCase>();

  if (caseError) {
    return new Response("Case not found", { status: 404 });
  }

  const [{ data: employee }, { data: shift }] = await Promise.all([
    supabase.from("employees").select("*").eq("id", attempt.employee_id).single<Employee>(),
    supabase.from("shifts").select("*").eq("id", absenceCase.shift_id).single<Shift>(),
  ]);

  const actionUrl = new URL(
    `/api/voice/response?attemptId=${encodeURIComponent(attemptId)}`,
    request.url,
  ).toString();
  const redirectUrl = new URL(
    `/api/voice/twiml?attemptId=${encodeURIComponent(attemptId)}`,
    request.url,
  ).toString();
  const employeeName = employee?.name ?? "there";
  const role = shift?.role ?? "shift";
  const startTime = shift
    ? new Date(shift.starts_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "soon";

  const prompt = xmlEscape(
    `Hi ${employeeName}, this is ShiftSaver. We have an open ${role} shift starting at ${startTime}. Can you cover it? Say yes or press 1 to accept. Say no or press 2 to decline.`,
  );

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="6" numDigits="1" action="${xmlEscape(actionUrl)}" method="POST">
    <Say voice="alice">${prompt}</Say>
  </Gather>
  <Redirect method="GET">${xmlEscape(redirectUrl)}</Redirect>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
