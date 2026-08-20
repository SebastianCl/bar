# ADR-0001: SPA estática con Supabase y Cloudflare Pages

- Estado: aceptada
- Fecha: 2026-08-19

## Contexto

El bar necesita un MVP económico para una sola terminal. La aplicación administra
productos enteros, cuentas abiertas, correcciones que devuelven inventario y recibos
internos en COP. No requiere facturación fiscal, pagos, impuestos, propinas, recetas ni
operación sin conexión.

## Decisión

- Implementar una SPA con React, TypeScript y Vite.
- Usar Supabase Auth para sesiones y PostgreSQL/RLS para datos y autorización.
- Ejecutar las mutaciones de venta mediante funciones RPC transaccionales; el navegador
  no coordina escrituras relacionadas.
- Publicar los archivos estáticos de `dist/` en Cloudflare Pages mediante GitHub Actions
  Direct Upload.
- Separar dos proyectos Supabase: preview y producción. Nunca apuntar una build de
  preview a la base de producción.
- No agregar servidor propio, Edge Functions, Realtime ni Storage al MVP.

## Consecuencias

- La operación tiene pocos componentes y un costo base bajo.
- PostgreSQL es la única fuente de verdad; el frontend puede volver a consultar después
  de una respuesta perdida.
- Los cambios de reglas operativas requieren una migración/RPC, no solo una modificación
  visual.
- La disponibilidad depende de Cloudflare y Supabase; no hay modo offline.
- Direct Upload y la integración Git nativa son modalidades distintas de Pages. Este
  repositorio elige Direct Upload para usar aprobaciones de GitHub Environments.

## Alternativas descartadas

- Backend Node dedicado: añade despliegue, secretos y mantenimiento sin resolver una
  necesidad del MVP.
- Escrituras CRUD encadenadas desde React: permiten estados parciales entre consumo,
  cuenta e inventario.
- Un único proyecto Supabase para preview y producción: eleva el riesgo de modificar
  datos reales desde pruebas.
