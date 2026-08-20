# Backlog por fases

Las fases están ordenadas por dependencia y terminan en un resultado demostrable. Los
ítems fuera del MVP permanecen explícitamente al final para evitar expansión accidental.

## Fase 0 — Base reproducible

- [x] React, TypeScript, Vite, ESLint, Vitest y Playwright.
- [x] Variables validadas y separación `development`, `preview`, `production`.
- [x] CI con lint, tipos, unitarias y build.
- [ ] Ejecutar CI verde con el lockfile definitivo.

**Salida:** cualquier colaborador puede instalar, verificar y construir el repositorio.

## Fase 1 — Identidad e inventario

- [ ] Aplicar migraciones a un proyecto Supabase de preview vacío.
- [ ] Crear el primer empleado mediante invitación; deshabilitar registro público.
- [x] Alta, edición, activación/desactivación y ajuste contado de productos.
- [x] Validaciones de nombre, precio COP y cantidad entera no negativa.
- [x] Políticas y pruebas automatizadas para denegar `anon` y usuarios inactivos.

**Salida:** un empleado invitado administra inventario sin acceso directo inseguro.

## Fase 2 — Cuentas y consumos

- [x] Abrir cuenta por cliente o mesa.
- [x] Agregar productos y mostrar total calculado solo con consumos vigentes.
- [x] Editar cantidad con descuento/devolución atómicos.
- [x] Anular línea y devolver toda la cantidad al inventario.
- [x] Cubrir reintentos con el mismo `request_id`.

**Salida:** flujo completo de una cuenta abierta con historial de correcciones.

## Fase 3 — Cierre y recibo

- [x] Cerrar la cuenta de manera idempotente.
- [x] Congelar cabecera y líneas en COP.
- [x] Vista imprimible responsive y reimpresión desde historial.
- [x] Impedir cambios posteriores al cierre.

**Salida:** el bar vende, cierra y reimprime recibos internos sin alterar el pasado.

## Fase 4 — Endurecimiento y lanzamiento

- [x] Pruebas locales de concurrencia e invariantes SQL/RLS.
- [ ] UAT táctil en la terminal real con datos de preview.
- [ ] Despliegue Cloudflare preview y producción con proyectos Supabase separados.
- [ ] Primer backup manual cifrado y ensayo de restauración en un proyecto desechable.
- [ ] Checklist de lanzamiento y capacitación del responsable del turno.

**Salida:** MVP operable con rollback, respaldo y responsables identificados.

## Fuera del MVP

Facturación electrónica/fiscal, impuestos, pagos y caja, propinas, descuentos, recetas o
ingredientes fraccionarios, múltiples sedes/terminales, modo offline, alertas automáticas,
analítica avanzada e integración contable.
