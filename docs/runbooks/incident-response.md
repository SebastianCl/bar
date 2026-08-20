# Runbook de respuesta a incidentes

## Principios

1. Proteger personas y operación primero.
2. Conservar movimientos, logs, recibos y timestamps; no “arreglar” borrando historial.
3. Evitar SQL manual en producción salvo diagnóstico de solo lectura o script revisado.
4. No rotar ni restaurar sin entender el alcance; ambas acciones pueden destruir
   evidencia o datos posteriores.

## Clasificación

| Severidad | Ejemplo                                                     | Acción inicial                                            |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| SEV-1     | acceso no autorizado, corrupción amplia, no se puede vender | suspender uso y convocar responsable técnico              |
| SEV-2     | stock/recibo incorrecto en flujo frecuente                  | detener el flujo afectado y usar registro manual temporal |
| SEV-3     | problema visual o caso aislado con alternativa              | registrar, contener y corregir en horario normal          |

## Triage de 15 minutos

- Registrar hora, usuario, cuenta/recibo/producto y pasos exactos.
- Capturar pantalla sin incluir credenciales.
- Consultar estado de Supabase y Cloudflare.
- Determinar si afecta frontend, Auth, RLS/RPC, datos o conectividad local.
- Identificar último despliegue y última migración.

## Acciones por tipo

### Frontend roto

1. No tocar la base.
2. Revertir al despliegue Pages conocido desde Deployments.
3. Verificar compatibilidad de la versión anterior con el esquema vigente.

### Credencial o sesión comprometida

1. Desactivar el empleado afectado.
2. Revocar sesiones y rotar el secreto comprometido; una publishable key por sí sola no
   concede permisos si RLS está correcto.
3. Auditar movimientos por `created_by` y ventana temporal.

### Diferencia de inventario

1. No editar `stock_quantity` directamente.
2. Comparar saldo, movimientos y líneas de cuenta.
3. Realizar conteo físico.
4. Usar el RPC de ajuste con motivo; conservar la diferencia como movimiento.

### Corrupción o eliminación masiva

1. Bloquear nuevas mutaciones y tomar un backup lógico del estado actual.
2. Estimar punto correcto y pérdida máxima.
3. Ensayar reparación/PITR/restauración en un proyecto nuevo.
4. Cambiar producción solo después de validar RLS y conteos.

## Cierre

Documentar causa, impacto, intervalo, datos afectados, recuperación, evidencia, acción
preventiva y responsable con fecha. Verificar el siguiente backup y añadir una prueba que
reproduzca el fallo cuando sea posible.
