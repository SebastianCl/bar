import { z } from 'zod';

const cleanText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio.`)
    .max(maximum, `${label} es demasiado largo.`);

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario.').max(60, 'El usuario es demasiado largo.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

export const recoverySchema = z.object({
  email: z.string().trim().email('Escribe un correo válido.'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Usa al menos 8 caracteres.'),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Las contraseñas no coinciden.',
  });

export const openTabSchema = z
  .object({
    tableLabel: z.string().trim().max(60, 'La mesa es demasiado larga.'),
    customerName: z.string().trim().max(100, 'El nombre es demasiado largo.'),
  })
  .refine((value) => Boolean(value.tableLabel || value.customerName), {
    path: ['tableLabel'],
    message: 'Indica una mesa o un cliente.',
  });

export const consumptionSchema = z.object({
  productId: z.string().uuid('Selecciona un producto válido.'),
  quantity: z.coerce
    .number()
    .int('Usa unidades completas.')
    .min(1, 'La cantidad mínima es 1.')
    .max(999),
});

export const itemQuantitySchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
});

export const productSchema = z.object({
  name: cleanText('El nombre', 120),
  sku: z.string().trim().max(50, 'El código es demasiado largo.'),
  salePrice: z.coerce
    .number()
    .min(0, 'El precio no puede ser negativo.')
    .multipleOf(0.01, 'Usa máximo dos decimales.'),
  isActive: z.boolean().default(true),
});

export const stockAdjustmentSchema = z.object({
  quantityDelta: z.coerce
    .number()
    .int('Usa unidades completas.')
    .refine((value) => value !== 0, {
      message: 'El ajuste no puede ser cero.',
    }),
  reason: cleanText('El motivo', 180),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type OpenTabInput = z.infer<typeof openTabSchema>;
export type ConsumptionInput = z.infer<typeof consumptionSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
