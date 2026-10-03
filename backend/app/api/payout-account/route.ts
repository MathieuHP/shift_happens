import { z } from "zod";

import { DomainError } from "@/lib/inapp/types";
import { handle, readJson } from "@/lib/inapp/http";
import { getAppState } from "@/lib/inapp/state";
import { createPayoutOnboarding, getPayoutAccountStatus } from "@/lib/payouts/service";
import { filePayoutsStore } from "@/lib/payouts/store";
import { frontendUrl, getStripe } from "@/lib/stripe/client";

// GET /api/payout-account?employee_id=eli -> { status: "none" | "pending" | "ready" }
export async function GET(request: Request) {
  return handle(() => {
    const employeeId = z.string().min(1, "employee_id manquant").parse(new URL(request.url).searchParams.get("employee_id"));
    return getPayoutAccountStatus({ stripe: getStripe(), store: filePayoutsStore }, employeeId);
  });
}

// POST /api/payout-account  { "employee_id": "eli", "email": "eli@example.com" } -> { url }
// Lien d'inscription hébergé par Stripe (identité, IBAN). L'e-mail est demandé à l'extra dans l'app.
export async function POST(request: Request) {
  return handle(async () => {
    const { employee_id, email } = z
      .object({ employee_id: z.string().min(1), email: z.string().email("e-mail invalide") })
      .parse(await readJson(request));
    const employee = getAppState().employees.find((e) => e.id === employee_id && e.active);
    if (!employee) throw new DomainError("employee_not_found", "Employé introuvable.", 404);

    return createPayoutOnboarding(
      { stripe: getStripe(), store: filePayoutsStore, frontendUrl: frontendUrl() },
      { id: employee.id, name: employee.name, email },
    );
  });
}
