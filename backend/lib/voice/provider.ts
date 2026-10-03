export type PlaceCallRequest = {
  idempotencyKey: string;
  toNumber: string;
};

export type PlaceCallResult = {
  mode: "simulated" | "live";
  conversationId: string | null;
  callSid: string | null;
};

export interface VoiceProvider {
  placeCall(request: PlaceCallRequest): Promise<PlaceCallResult>;
}

export class SimulatedVoiceProvider implements VoiceProvider {
  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
    console.info(
      `[SIMULÉ] Voice call requested (key=${request.idempotencyKey}, to=${request.toNumber})`,
    );
    return { mode: "simulated", conversationId: null, callSid: null };
  }
}

export type ElevenLabsVoiceProviderConfig = {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
  fetchImpl?: typeof fetch;
};

type ElevenLabsOutboundCallResponse = {
  success: boolean;
  conversation_id?: string | null;
  callSid?: string | null;
};

export class ElevenLabsVoiceProvider implements VoiceProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ElevenLabsVoiceProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
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
          agent_phone_number_id: this.config.agentPhoneNumberId,
          to_number: request.toNumber,
          call_recording_enabled: false,
        }),
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
}
