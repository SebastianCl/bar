import { z } from 'zod';

export const supabasePublishableKeySchema = z
  .string()
  .min(20, 'La publishable key de Supabase no es válida.')
  .startsWith(
    'sb_publishable_',
    'Usa una publishable key de Supabase. Nunca incluyas una secret o service_role key en el navegador.',
  );

export const environmentSchema = z
  .object({
    VITE_APP_ENV: z
      .enum(['development', 'preview', 'production', 'test'])
      .default('development'),
    VITE_USE_DUMMY_DATA: z.enum(['true', 'false']).default('false'),
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.VITE_USE_DUMMY_DATA === 'true') return;
    const url = z
      .string()
      .url('La URL de Supabase no es válida.')
      .safeParse(value.VITE_SUPABASE_URL);
    if (!url.success)
      context.addIssue({
        code: 'custom',
        message: url.error.issues[0]?.message ?? 'Falta la URL de Supabase.',
      });
    const key = supabasePublishableKeySchema.safeParse(
      value.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    if (!key.success)
      context.addIssue({
        code: 'custom',
        message:
          key.error.issues[0]?.message ?? 'Falta la clave publicable de Supabase.',
      });
  });

const parsedEnvironment = environmentSchema.safeParse(import.meta.env);

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function isDummyMode(): boolean {
  return (
    parsedEnvironment.success && parsedEnvironment.data.VITE_USE_DUMMY_DATA === 'true'
  );
}

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
