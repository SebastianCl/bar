import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function response(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  let credentials: { username?: unknown; password?: unknown };
  try {
    credentials = await request.json();
  } catch {
    return response({ error: 'invalid_credentials' }, 400);
  }

  const username =
    typeof credentials.username === 'string'
      ? credentials.username.trim().toLowerCase()
      : '';
  const password = typeof credentials.password === 'string' ? credentials.password : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length === 0) {
    return response({ error: 'invalid_credentials' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: email, error: lookupError } = await admin.rpc('get_login_email', {
    p_username: username,
  });
  if (lookupError || !email) return response({ error: 'invalid_credentials' }, 400);

  const tokenResponse = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!tokenResponse.ok) return response({ error: 'invalid_credentials' }, 400);

  const session = await tokenResponse.json();
  return response({ session }, 200);
});
