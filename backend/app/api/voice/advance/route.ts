import { callNextCandidate } from "@/lib/cascade/callNextCandidate";
import { optionalEnv, requireEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { secretsMatch } from "@/lib/voice/respondToOffer";

function getCallTimeoutSeconds() {
  const value = Number(optionalEnv("CALL_TIMEOUT_SECONDS") ?? "45");
  if (!Number.isInteger(value) || value < 1 || value > 3600) {
    throw new Error("CALL_TIMEOUT_SECONDS must be between 1 and 3600");
  }
  return value;
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-voice-secret");
  if (!suppliedSecret || !secretsMatch(requireEnv("VOICE_TOOL_SECRET"), suppliedSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - getCallTimeoutSeconds() * 1000).toISOString();
    const supabase = createSupabaseServiceClient();
    const { data: attempts, error } = await supabase
      .from("call_attempts")
      .select("id, absence_case_id")
      .eq("status", "calling")
      .not("voice_conversation_id", "is", null)
      .lt("created_at", cutoff);
    if (error) throw error;

    const advanced: string[] = [];
    for (const attempt of attempts ?? []) {
      const { data: expired, error: updateError } = await supabase
        .from("call_attempts")
        .update({ status: "no_answer" })
        .eq("id", attempt.id)
        .eq("status", "calling")
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!expired) continue;
      await callNextCandidate(attempt.absence_case_id);
      advanced.push(attempt.id);
    }
    return Response.json({ advancedCount: advanced.length });
  } catch (error) {
    console.error("Voice call timeout processing failed", error);
    return Response.json({ error: "timeout_processing_failed" }, { status: 500 });
  }
}
