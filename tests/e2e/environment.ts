const requiredApplicationVariables = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const;

const missingApplicationVariables = requiredApplicationVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingApplicationVariables.length > 0) {
  throw new Error(
    `E2E requiere variables de preview: ${missingApplicationVariables.join(', ')}`,
  );
}

export const supabaseUrl = process.env.VITE_SUPABASE_URL!.trim();
export const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!.trim();

if (!supabasePublishableKey.startsWith('sb_publishable_')) {
  throw new Error(
    'VITE_SUPABASE_PUBLISHABLE_KEY debe ser una publishable key con prefijo sb_publishable_.',
  );
}

const credentialVariables = [
  'E2E_EMAIL',
  'E2E_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const;

if (process.env.E2E_REQUIRE_ENV === '1') {
  const missingCredentials = credentialVariables.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missingCredentials.length > 0) {
    throw new Error(
      `E2E_REQUIRE_ENV=1: faltan credenciales obligatorias de staff/admin: ${missingCredentials.join(', ')}.`,
    );
  }
}

type Credentials = { email: string; password: string };

export function readCredentials(
  emailVariable: 'E2E_EMAIL' | 'E2E_ADMIN_EMAIL',
  passwordVariable: 'E2E_PASSWORD' | 'E2E_ADMIN_PASSWORD',
  description: string,
): Credentials | null {
  const email = process.env[emailVariable]?.trim();
  const password = process.env[passwordVariable]?.trim();
  const missing: string[] = [];
  if (!email) missing.push(emailVariable);
  if (!password) missing.push(passwordVariable);

  if (process.env.E2E_REQUIRE_ENV === '1' && missing.length > 0) {
    throw new Error(
      `E2E_REQUIRE_ENV=1: faltan ${missing.join(', ')} para ${description}.`,
    );
  }

  return email && password ? { email, password } : null;
}
