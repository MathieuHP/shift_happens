import { optionalEnv } from "@/lib/env";

export async function GET() {
  return Response.json({
    ok: true,
    service: "shiftsaver-backend",
    timestamp: new Date().toISOString(),
    config: {
      supabaseUrl: Boolean(optionalEnv("NEXT_PUBLIC_SUPABASE_URL")),
      supabaseServiceKey: Boolean(optionalEnv("SUPABASE_SERVICE_ROLE_KEY")),
      appUrl: Boolean(optionalEnv("NEXT_PUBLIC_APP_URL")),
      twilio: Boolean(
        optionalEnv("TWILIO_ACCOUNT_SID") &&
          optionalEnv("TWILIO_AUTH_TOKEN") &&
          optionalEnv("TWILIO_FROM_NUMBER"),
      ),
    },
  });
}
