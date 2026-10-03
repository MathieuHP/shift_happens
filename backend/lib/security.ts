import { optionalEnv } from "@/lib/env";

// Protège les routes /api/demo/* : si la variable DEMO_SECRET est définie (serveur en ligne),
// la requête doit envoyer le même secret dans l'en-tête `x-demo-secret`.
// Sans DEMO_SECRET (développement local), tout est ouvert.
// Attention : un navigateur ne peut pas garder un secret. Cette protection vise les appels
// manuels (curl) ; les vraies routes de l'app auront besoin d'une authentification plus tard.
export function checkDemoSecret(request: Request): Response | null {
  const secret = optionalEnv("DEMO_SECRET");
  if (!secret) return null;

  if (request.headers.get("x-demo-secret") !== secret) {
    return Response.json({ error: { code: "forbidden", message: "Secret de démo manquant ou incorrect." } }, { status: 403 });
  }
  return null;
}
