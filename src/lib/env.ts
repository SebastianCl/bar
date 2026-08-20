import { z } from 'zod';

export const supabasePublishableKeySchema = z
  .string()
  .min(20, 'La publishable key de Supabase no es válida.')
  .startsWith(
    'sb_publishable_',
    'Usa una publishable key de Supabase. Nunca incluyas una secret o service_role key en el navegador.',
  );

export const environmentSchema = z.object({
  VITE_APP_ENV: z
    .enum(['development', 'preview', 'production', 'test'])
    .default('development'),
  VITE_SUPABASE_URL: z.string().url('La URL de Supabase no es válida.'),
  VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKeySchema,
});

const parsedEnvironment = environmentSchema.safeParse(import.meta.env);

export type AppEnvironment = z.infer<typeof environmentSchema>;

export class ConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('La aplicación no está configurada correctamente.');
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

export function getEnvironment(): AppEnvironment {
  if (!parsedEnvironment.success) {
    throw new ConfigurationError(
      parsedEnvironment.error.issues.map((issue) => issue.message),
    );
  }

  return parsedEnvironment.data;
}

export function getEnvironmentIssues(): string[] {
  return parsedEnvironment.success
    ? []
    : parsedEnvironment.error.issues.map((issue) => issue.message);
}
