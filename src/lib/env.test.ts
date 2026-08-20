import { describe, expect, it } from 'vitest';
import { supabasePublishableKeySchema } from './env';

describe('seguridad de variables del navegador', () => {
  it('acepta una publishable key de Supabase', () => {
    expect(
      supabasePublishableKeySchema.safeParse(
        'sb_publishable_abcdefghijklmnopqrstuvwxyz',
      ).success,
    ).toBe(true);
  });

  it.each([
    'sb_secret_abcdefghijklmnopqrstuvwxyz',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature',
  ])('rechaza una clave secreta: %s', (key) => {
    const result = supabasePublishableKeySchema.safeParse(key);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain('Nunca incluyas');
  });
});
