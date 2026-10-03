import { describe, expect, it, vi } from "vitest";
import {
  ElevenLabsVoiceProvider,
  SimulatedVoiceProvider,
  type VoiceProvider,
} from "../lib/voice/provider";

describe("VoiceProvider", () => {
  it("supports a fake provider without starting a real call", async () => {
    const fake: VoiceProvider = {
      placeCall: vi.fn<VoiceProvider["placeCall"]>(async () => ({
        mode: "simulated",
        conversationId: "conversation-test",
        callSid: "call-test",
      })),
    };

    await expect(
      fake.placeCall({ idempotencyKey: "offer-1-candidate-1", toNumber: "+15550000000" }),
    ).resolves.toEqual({
      mode: "simulated",
      conversationId: "conversation-test",
      callSid: "call-test",
    });
    expect(fake.placeCall).toHaveBeenCalledTimes(1);
  });

  it("labels the simulated provider and returns no external call identifiers", async () => {
    const provider = new SimulatedVoiceProvider();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      provider.placeCall({ idempotencyKey: "demo-1", toNumber: "+15550000000" }),
    ).resolves.toEqual({ mode: "simulated", conversationId: null, callSid: null });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("[SIMULÉ]"));
    info.mockRestore();
  });

  it("sends the documented ElevenLabs fields and disables recording", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, conversation_id: "conv-1", callSid: "CA1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new ElevenLabsVoiceProvider({
      apiKey: "test-key",
      agentId: "agent-1",
      agentPhoneNumberId: "phone-1",
      fetchImpl,
    });

    await expect(
      provider.placeCall({ idempotencyKey: "key-1", toNumber: "+15550000000" }),
    ).resolves.toEqual({ mode: "live", conversationId: "conv-1", callSid: "CA1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "xi-api-key": "test-key" }),
        body: JSON.stringify({
          agent_id: "agent-1",
          agent_phone_number_id: "phone-1",
          to_number: "+15550000000",
          call_recording_enabled: false,
        }),
      }),
    );
  });

  it("does not hide provider errors", async () => {
    const provider = new ElevenLabsVoiceProvider({
      apiKey: "test-key",
      agentId: "agent-1",
      agentPhoneNumberId: "phone-1",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    });

    await expect(
      provider.placeCall({ idempotencyKey: "key-1", toNumber: "+15550000000" }),
    ).rejects.toThrow("HTTP 503");
  });

  it("resolves the ElevenLabs phone resource ID from the configured agent and number", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          phone_number: "+15550000000",
          phone_number_id: "wrong-phone",
          assigned_agent: { agent_id: "other-agent" },
        },
        {
          phone_number: "+15550000000",
          phone_number_id: "phone-resource-1",
          assigned_agent: { agent_id: "agent-1" },
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const provider = new ElevenLabsVoiceProvider({
      apiKey: "test-key",
      agentId: "agent-1",
      phoneNumber: "+15550000000",
      fetchImpl,
    });

    await provider.placeCall({ idempotencyKey: "key-1", toNumber: "+15550000001" });
    const outboundOptions = fetchImpl.mock.calls[1]?.[1];
    expect(JSON.parse(String(outboundOptions?.body))).toMatchObject({
      agent_phone_number_id: "phone-resource-1",
      to_number: "+15550000001",
    });
  });
});
