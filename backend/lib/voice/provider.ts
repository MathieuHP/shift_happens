export type PlaceCallRequest = {
  idempotencyKey: string;
  toNumber: string;
  dynamicVariables?: Record<string, string>;
};

export type PlaceCallResult = {
  mode: "simulated" | "live";
  conversationId: string | null;
  callSid: string | null;
};

// État d'un appel côté fournisseur : sonne · en conversation · terminé · échoué · inconnu
export type CallLiveStatus = "ringing" | "in_progress" | "ended" | "failed" | "unknown";

export interface VoiceProvider {
  prepare?(): Promise<void>;
  placeCall(request: PlaceCallRequest): Promise<PlaceCallResult>;
  getCallStatus?(conversationId: string): Promise<CallLiveStatus>;
}

export class SimulatedVoiceProvider implements VoiceProvider {
  async getCallStatus(): Promise<CallLiveStatus> {
    return "unknown"; // appel simulé : pas de vrai état, seul le délai s'applique
  }

  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
    console.info(`[SIMULÉ] Voice call requested (key=${request.idempotencyKey})`);
    return {
      mode: "simulated",
      conversationId: `simulated-${request.idempotencyKey}`,
      callSid: null,
    };
  }
}

export type ElevenLabsVoiceProviderConfig = {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId?: string;
  phoneNumber?: string;
  fetchImpl?: typeof fetch;
};

type ElevenLabsOutboundCallResponse = {
  success: boolean;
  conversation_id?: string | null;
  callSid?: string | null;
};

export class ElevenLabsVoiceProvider implements VoiceProvider {
  private readonly fetchImpl: typeof fetch;
  private agentPhoneNumberId: string | null;

  constructor(private readonly config: ElevenLabsVoiceProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.agentPhoneNumberId = config.agentPhoneNumberId ?? null;
  }

  async prepare() {
    if (this.agentPhoneNumberId) return;
    if (!this.config.phoneNumber) {
      throw new Error("ElevenLabs phone number is required to resolve its phone number ID");
    }

    const query = new URLSearchParams({ agent_id: this.config.agentId, provider: "twilio" });
    const response = await this.fetchImpl(
      `https://api.elevenlabs.io/v1/convai/phone-numbers?${query.toString()}`,
      { headers: { "xi-api-key": this.config.apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      throw new Error(`ElevenLabs phone number lookup failed with HTTP ${response.status}`);
    }
    const rows = (await response.json()) as Array<{
      phone_number?: string;
      phone_number_id?: string;
      assigned_agent?: { agent_id?: string };
    }>;
    const match = rows.find((row) =>
      row.phone_number === this.config.phoneNumber &&
      row.assigned_agent?.agent_id === this.config.agentId &&
      typeof row.phone_number_id === "string",
    );
    if (!match?.phone_number_id) {
      throw new Error("No ElevenLabs Twilio number matching the configured number and agent was found");
    }
    this.agentPhoneNumberId = match.phone_number_id;
  }

  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
    await this.prepare();
    const response = await this.fetchImpl(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.config.apiKey,
        },
        body: JSON.stringify({
          agent_id: this.config.agentId,
          agent_phone_number_id: this.agentPhoneNumberId,
          to_number: request.toNumber,
          call_recording_enabled: false,
          ...(request.dynamicVariables
            ? { conversation_initiation_client_data: { dynamic_variables: request.dynamicVariables } }
            : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs outbound call failed with HTTP ${response.status}`);
    }

    const result = (await response.json()) as ElevenLabsOutboundCallResponse;
    if (!result.success) {
      throw new Error("ElevenLabs did not accept the outbound call request");
    }

    return {
      mode: "live",
      conversationId: result.conversation_id ?? null,
      callSid: result.callSid ?? null,
    };
  }

  // GET /v1/convai/conversations/{id} : statuts documentés `initiated`, `in-progress`, `processing`, `done`, `failed`.
  // `initiated` = l'appel sonne, `in-progress` = la personne a décroché et parle avec l'agent.
  async getCallStatus(conversationId: string): Promise<CallLiveStatus> {
    const response = await this.fetchImpl(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { "xi-api-key": this.config.apiKey }, signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) return "unknown"; // ne jamais faire échouer un appel à cause d'une lecture d'état
    const body = (await response.json()) as { status?: unknown };
    switch (body.status) {
      case "initiated":
        return "ringing";
      case "in-progress":
        return "in_progress";
      case "processing":
      case "done":
        return "ended";
      case "failed":
        return "failed";
      default:
        return "unknown";
    }
  }
}
