import type { SupabaseClient } from "@supabase/supabase-js";

import { getEligibleCandidates } from "@/lib/matching/eligibleCandidates";
import type { Employee, Shift } from "@/lib/types";

export async function findEligibleCandidates(
  supabase: SupabaseClient,
  input: {
    shift: Shift;
    absentEmployeeId: string;
  },
) {
  const { data: employees, error: employeesError } = (await supabase
    .from("employees")
    .select("*")
    .eq("active", true)) as { data: Employee[] | null; error: Error | null };

  if (employeesError) {
    throw employeesError;
  }

  const { data: shifts, error: shiftsError } = (await supabase
    .from("shifts")
    .select("*")) as { data: Shift[] | null; error: Error | null };

  if (shiftsError) {
    throw shiftsError;
  }

  return getEligibleCandidates({
    employees: employees ?? [],
    shifts: shifts ?? [],
    shift: input.shift,
    absentEmployeeId: input.absentEmployeeId,
  });
}
