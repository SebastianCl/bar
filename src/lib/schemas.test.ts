import { describe, expect, it } from 'vitest';
import {
  consumptionSchema,
  openTabSchema,
  productSchema,
  resetPasswordSchema,
} from './schemas';

describe('esquemas de formularios', () => {
  it('acepta precios con hasta dos decimales', () => {
    const result = productSchema.safeParse({
      name: 'Cerveza artesanal',
      sku: 'CER-01',
      salePrice: '12900.25',
      isActive: true,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza precios con más de dos decimales', () => {
    const result = productSchema.safeParse({
      name: 'Agua',
      sku: '',
      salePrice: '1000.125',
      isActive: true,
    });

    expect(result.success).toBe(false);
  });

  it('exige una referencia para abrir la cuenta', () => {
    expect(
      openTabSchema.safeParse({ tableLabel: '  ', customerName: '' }).success,
    ).toBe(false);
    expect(
      openTabSchema.safeParse({ tableLabel: 'Terraza 2', customerName: '' }).success,
    ).toBe(true);
  });

  it('solo admite cantidades enteras positivas', () => {
    const productId = '103f0ef8-3df7-49f6-9b23-85d27602481f';
    expect(consumptionSchema.safeParse({ productId, quantity: '2' }).success).toBe(
      true,
    );
    expect(consumptionSchema.safeParse({ productId, quantity: '1.5' }).success).toBe(
      false,
    );
    expect(consumptionSchema.safeParse({ productId, quantity: '0' }).success).toBe(
      false,
    );
  });

  it('detecta contraseñas de confirmación diferentes', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'una-clave-segura',
      confirmation: 'otra-clave-segura',
    });

    expect(result.success).toBe(false);
  });
});
