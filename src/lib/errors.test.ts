import { describe, expect, it } from 'vitest';
import { AppError, normalizeError } from './errors';

describe('normalización de errores', () => {
  it.each([
    [{ message: 'insufficient_stock' }, 'OUT_OF_STOCK'],
    [{ message: 'out_of_stock' }, 'OUT_OF_STOCK'],
    [{ code: '23505', message: 'duplicate key' }, 'CONFLICT'],
    [{ code: 'duplicate_open_table' }, 'CONFLICT'],
    [{ code: 'idempotency_conflict' }, 'CONFLICT'],
    [{ code: 'validation' }, 'VALIDATION'],
    [{ code: 'unauthenticated' }, 'AUTH_REQUIRED'],
    [{ code: '42501', message: 'permission denied' }, 'FORBIDDEN'],
    [{ status: 401 }, 'AUTH_REQUIRED'],
    [{ status: 404 }, 'NOT_FOUND'],
  ] as const)('convierte %o en %s', (source, expectedCode) => {
    expect(normalizeError(source).code).toBe(expectedCode);
  });

  it('conserva errores de aplicación ya normalizados', () => {
    const original = new AppError('OFFLINE', 'Sin conexión');
    expect(normalizeError(original)).toBe(original);
  });

  it('usa un mensaje seguro para errores desconocidos', () => {
    const result = normalizeError(new Error('detalle interno'), 'No se pudo guardar.');
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('No se pudo guardar.');
    expect(result.details).toBe('detalle interno');
  });
});
