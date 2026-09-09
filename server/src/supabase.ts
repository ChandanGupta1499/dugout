import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

let client: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS; never expose this key to Expo. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        // Node < 22 has no global WebSocket; supabase-js still inits realtime on createClient.
        realtime: { transport: ws as unknown as typeof WebSocket },
      },
    );
  }
  return client;
}

export function assertSupabaseConfigured(): void {
  requireEnv('SUPABASE_URL');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}
