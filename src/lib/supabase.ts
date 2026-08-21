import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ConfigurationError, getEnvironment, isDummyMode } from './env';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  if (isDummyMode()) {
    throw new ConfigurationError([
      'Supabase no está disponible mientras VITE_USE_DUMMY_DATA=true.',
    ]);
  }

  const environment = getEnvironment();
  if (!environment.VITE_SUPABASE_URL || !environment.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new ConfigurationError(['Faltan las credenciales públicas de Supabase.']);
  }
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
