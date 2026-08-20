import { describe, expect, it } from 'vitest';
import {
  bogotaDayRange,
  formatCurrency,
  formatDate,
  formatDateTime,
  roleLabel,
  toBogotaDateKey,
} from './format';

describe('formato local', () => {
  it('formatea importes COP sin perder centavos', () => {
    const formatted = formatCurrency('12345.67');
    expect(formatted).toContain('$');
    expect(formatted).toContain('12.345,67');
  });

  it('tolera fechas vacías o inválidas', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime('fecha-inválida')).toBe('—');
  });

  it('fija las fechas operativas a America/Bogota', () => {
    expect(toBogotaDateKey('2026-08-20T04:30:00.000Z')).toBe('2026-08-19');
    expect(toBogotaDateKey('2026-08-20T05:00:00.000Z')).toBe('2026-08-20');
    expect(bogotaDayRange('2026-12-31')).toEqual({
      start: '2026-12-31T00:00:00-05:00',
      end: '2027-01-01T00:00:00-05:00',
    });
  });

  it('traduce los roles del MVP', () => {
    expect(roleLabel('admin')).toBe('Administrador');
    expect(roleLabel('staff')).toBe('Operación');
  });
});
