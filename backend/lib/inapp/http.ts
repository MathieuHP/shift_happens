import { ZodError } from "zod";

import { DomainError } from "./types";

// Exécute une route et transforme les erreurs en réponses JSON propres :
// { "error": { "code": "...", "message": "..." } } avec le bon code HTTP.
export async function handle(run: () => Promise<unknown> | unknown): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (error) {
    if (error instanceof DomainError) {
      return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: { code: "invalid_request", message: error.issues.map((i) => i.message).join(", ") } }, { status: 400 });
    }
    console.error("Unexpected error", error);
    return Response.json({ error: { code: "server_error", message: "Erreur serveur." } }, { status: 500 });
  }
}

// Lit le corps JSON (ou {} s'il est vide).
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}));
}
