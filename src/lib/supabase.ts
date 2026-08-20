import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnvironment } from './env';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const environment = getEnvironment();
  client = createClient<Database>(
    environment.VITE_SUPABASE_URL,
    environment.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
      global: {
        headers: { 'x-application-name': 'bar-operations-spa' },
      },
    },
  );

  return client;
}
