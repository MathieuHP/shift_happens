import { optionalEnv } from "@/lib/env";
import { getAppState } from "@/lib/inapp/state";
import { restaurantTimezone } from "@/lib/inapp/time";
import { checkDemoSecret } from "@/lib/security";
import { checkContactPolicy } from "@/lib/voice/contactPolicy";

// Les derniers chiffres suffisent à reconnaître un numéro sans l'exposer en entier.
const mask = (phone: string) => `${phone.slice(0, 3)}…${phone.slice(-3)}`;

// Vérifie auprès d'ElevenLabs (lecture seule, aucun appel) : la clé est acceptée, l'agent existe, le numéro lui est assigné.
async function verifyElevenLabs() {
  const headers = { "xi-api-key": optionalEnv("ELEVENLABS_API_KEY") ?? "" };
  const agentId = optionalEnv("ELEVENLABS_AGENT_ID") ?? "";
  const phoneId = optionalEnv("ELEVENLABS_AGENT_PHONE_NUMBER_ID");
  const phone = optionalEnv("ELEVENLABS_PHONE_NUMBER");

  const agentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    headers,
    signal: AbortSignal.timeout(8_000),
  });
  if (agentResponse.status === 401) throw new Error("clé API refusée (401)");
  if (!agentResponse.ok) throw new Error(`agent introuvable (HTTP ${agentResponse.status})`);
  const agent = (await agentResponse.json()) as { name?: string };

  const numbersResponse = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers, signal: AbortSignal.timeout(8_000) });
  if (!numbersResponse.ok) return `agent « ${agent.name ?? agentId} » trouvé ; numéros non vérifiés (HTTP ${numbersResponse.status}, droits de la clé ?)`;
  const rows = (await numbersResponse.json()) as Array<{ phone_number?: string; phone_number_id?: string; assigned_agent?: { agent_id?: string } }>;
  const row = rows.find((r) => (phoneId && r.phone_number_id === phoneId) || (phone && r.phone_number === phone));
  if (!row) throw new Error("numéro introuvable chez ElevenLabs");
  if (row.assigned_agent?.agent_id !== agentId) throw new Error("ce numéro n'est pas assigné à l'agent configuré");
  return `ok : agent « ${agent.name ?? agentId} », numéro ${mask(row.phone_number ?? "")} assigné à l'agent`;
}

// GET /api/voice/health : diagnostic de la voix, SANS appeler personne.
// Dit ce qui manque dans la configuration, et (si la voix est activée) vérifie que ElevenLabs reconnaît le numéro et l'agent.
export async function GET(request: Request) {
  const denied = checkDemoSecret(request);
  if (denied) return denied;

  const enabled = optionalEnv("VOICE_ENABLED") === "true";
  const config = {
    api_key: Boolean(optionalEnv("ELEVENLABS_API_KEY")),
    agent_id: Boolean(optionalEnv("ELEVENLABS_AGENT_ID")),
    phone_number: Boolean(optionalEnv("ELEVENLABS_PHONE_NUMBER") || optionalEnv("ELEVENLABS_AGENT_PHONE_NUMBER_ID")),
    tool_secret: Boolean(optionalEnv("VOICE_TOOL_SECRET")),
    webhook_secret: Boolean(optionalEnv("ELEVENLABS_WEBHOOK_SECRET")),
  };

  const windowStart = optionalEnv("CONTACT_WINDOW_START") ?? "09:00";
  const windowEnd = optionalEnv("CONTACT_WINDOW_END") ?? "20:00";
  const open = checkContactPolicy({
    consentAt: "yes",
    now: new Date(),
    timeZone: restaurantTimezone(),
    windowStart,
    windowEnd,
  }).allowed;

  const override = optionalEnv("DEMO_PHONE_OVERRIDE");
  const recipients = Object.fromEntries(
    getAppState().employees
      .filter((e) => ["kash", "mathieu"].includes(e.id))
      .map((e) => [e.id, override ? `${mask(override)} (DEMO_PHONE_OVERRIDE)` : mask(e.phone)]),
  );

  const problems: string[] = [];
  if (!enabled) problems.push("VOICE_ENABLED n'est pas « true » : les appels sont simulés (aucun vrai appel).");
  if (enabled && !config.api_key) problems.push("ELEVENLABS_API_KEY manquante.");
  if (enabled && !config.agent_id) problems.push("ELEVENLABS_AGENT_ID manquant.");
  if (enabled && !config.phone_number) problems.push("ELEVENLABS_PHONE_NUMBER manquant.");
  if (!config.tool_secret) problems.push("VOICE_TOOL_SECRET manquant : l'agent ne pourra pas enregistrer les réponses (/api/voice/respond).");
  if (!open) problems.push(`Hors de la plage d'appel ${windowStart}–${windowEnd} (${restaurantTimezone()}) : les candidats seront ignorés.`);
  if (override) problems.push("DEMO_PHONE_OVERRIDE est défini : tous les appels vont à ce seul numéro.");
  if (Object.values(recipients).some((r) => r.includes("+3255500"))) problems.push("Un candidat a un faux numéro : renseignez DEMO_PHONE_KASH / DEMO_PHONE_MATHIEU.");

  // Vérification réelle auprès d'ElevenLabs (lecture seule, ne passe aucun appel).
  let provider_check = "ignorée (voix désactivée ou configuration incomplète)";
  if (enabled && config.api_key && config.agent_id && config.phone_number) {
    try {
      provider_check = await verifyElevenLabs();
    } catch (error) {
      provider_check = `échec : ${error instanceof Error ? error.message : "erreur inconnue"}`;
      problems.push(`ElevenLabs : ${provider_check}`);
    }
  }

  return Response.json({
    voice_enabled: enabled,
    mode: enabled ? "live" : "simulé",
    config,
    contact_window: { start: windowStart, end: windowEnd, timezone: restaurantTimezone(), open_now: open },
    call_timeout_seconds: Number(optionalEnv("CALL_TIMEOUT_SECONDS") ?? "30"),
    recipients,
    provider_check,
    ready: problems.length === 0,
    problems,
  });
}
