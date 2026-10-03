import twilio from "twilio";

import { optionalEnv, requireEnv } from "@/lib/env";

export function getTwilioClient() {
  return twilio(
    requireEnv("TWILIO_ACCOUNT_SID"),
    requireEnv("TWILIO_AUTH_TOKEN"),
  );
}

export function getTwilioFromNumber() {
  return requireEnv("TWILIO_FROM_NUMBER");
}

export function getPublicBaseUrl() {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
}

export function hasTwilioConfig() {
  return Boolean(
    optionalEnv("TWILIO_ACCOUNT_SID") &&
      optionalEnv("TWILIO_AUTH_TOKEN") &&
      optionalEnv("TWILIO_FROM_NUMBER") &&
      optionalEnv("NEXT_PUBLIC_APP_URL"),
  );
}
