import { optionalEnv, requireEnv } from "@/lib/env";
import {
  ElevenLabsVoiceProvider,
  SimulatedVoiceProvider,
  type VoiceProvider,
} from "@/lib/voice/provider";

export function getVoiceProvider(): VoiceProvider {
  if (process.env.VOICE_ENABLED !== "true") return new SimulatedVoiceProvider();

  return new ElevenLabsVoiceProvider({
    apiKey: requireEnv("ELEVENLABS_API_KEY"),
    agentId: requireEnv("ELEVENLABS_AGENT_ID"),
    agentPhoneNumberId: optionalEnv("ELEVENLABS_AGENT_PHONE_NUMBER_ID") ?? undefined,
    phoneNumber: optionalEnv("ELEVENLABS_PHONE_NUMBER") ?? undefined,
  });
}

export function getVoiceRecipient(phone: string) {
  return optionalEnv("DEMO_PHONE_OVERRIDE") ?? phone;
}
