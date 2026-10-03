export function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string) {
  return process.env[name] || null;
}

export function hasSupabaseConfig() {
  return Boolean(
    optionalEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}
