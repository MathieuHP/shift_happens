import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventType } from "@/lib/types";

export async function insertEvent(
  supabase: SupabaseClient,
  input: {
    absenceCaseId?: string | null;
    type: EventType;
    message: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("events").insert({
    absence_case_id: input.absenceCaseId ?? null,
    type: input.type,
    message: input.message,
    payload: input.payload ?? {},
  });

  if (error) {
    throw error;
  }
}
