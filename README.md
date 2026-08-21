# Bar MVP

Aplicación web interna para inventario, cuentas abiertas, consumos y recibos no fiscales
en COP. Está diseñada para una terminal y conserva el historial de precios, correcciones
e inventario.

## Stack

- React 19, TypeScript y Vite.
- Supabase Auth, PostgreSQL, RLS y funciones RPC transaccionales.
- Cloudflare Pages para el frontend estático.
- Vercel como despliegue provisional para la demo pública.
- Vitest, Playwright, ESLint y Prettier.
- GitHub Actions para CI, despliegue y backups lógicos cifrados.

## Requisitos

- Node.js 22.12 o superior.
- pnpm 11 (`corepack enable` permite usar la versión fijada en `package.json`).
- Docker Desktop para Supabase local y un proyecto preview para integración.

## Inicio local

### Demo sin Supabase

Para recorrer toda la aplicación con datos de muestra, sin crear un proyecto ni configurar Auth:

```bash
pnpm install
pnpm dev:demo
```

Abre la URL indicada por Vite. Entrarás automáticamente como administrador y podrás modificar inventario, abrir cuentas, registrar consumos, cerrar ventas e imprimir comprobantes. Los cambios se guardan en `localStorage`; usa **Reiniciar datos demo** en la barra lateral para volver al estado inicial.

### Desarrollo con Supabase

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

En PowerShell, usar `Copy-Item .env.example .env.local`. Completar únicamente:

```dotenv
VITE_APP_ENV=development
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No usar `service_role` en una variable `VITE_*`: todo valor con ese prefijo se incluye en
el navegador.

## Preparar Supabase

Con [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):

```sh
supabase login
supabase link --project-ref PROJECT_REF_DE_PREVIEW
supabase db push
```

Después, deshabilitar el registro público y seguir el
[runbook de usuarios](docs/runbooks/user-provisioning.md) para configurar el redirect
`/auth/callback?next=/restablecer`, invitar, activar y dejar dos administradores más
staff. No ejecutar SQL de producción desde el frontend ni exponer secretos del proyecto.

## Comandos

| Comando             | Uso                                      |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | servidor local                           |
| `pnpm lint`         | reglas ESLint                            |
| `pnpm typecheck`    | TypeScript estricto                      |
| `pnpm test`         | pruebas Vitest                           |
| `pnpm build`        | build reproducible en `dist/`            |
| `pnpm preview`      | servir el build local                    |
| `pnpm e2e`          | flujos E2E local/preview                 |
| `pnpm db:start`     | iniciar Supabase local                   |
| `pnpm db:stop`      | detener Supabase local conservando datos |
| `pnpm db:reset`     | recrear la base desde migraciones/seed   |
| `pnpm db:test`      | ejecutar pruebas pgTAP                   |
| `pnpm db:lint`      | analizar funciones y esquema local       |
| `pnpm format:check` | comprobar formato                        |

Los E2E requieren `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Si
`PLAYWRIGHT_BASE_URL` no está definido, Playwright construye y sirve la aplicación en
`http://127.0.0.1:4173`; si existe, prueba esa URL sin levantar servidor local.
`E2E_EMAIL` y `E2E_PASSWORD` habilitan además el smoke autenticado y deben pertenecer a
un empleado exclusivo de preview. `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD` habilitan
el flujo transaccional completo: crear producto y cuenta, agregar y editar consumo,
disparar dos cierres RPC concurrentes, confirmar que comparten comprobante, cerrar desde
la UI e invocar impresión. Sin `E2E_REQUIRE_ENV=1`, una pareja ausente omite su prueba;
con ese flag —obligatorio en GitHub Actions— falta de staff o admin hace fallar la suite.
Nunca usar usuarios de producción.

Playwright ejecuta los smoke en viewports exactos `360×800`, `768×1024` y `1440×900`;
el flujo administrativo que escribe datos corre una sola vez en `1440×900`.

## Arquitectura y operación

- [Arquitectura, ER y contrato RPC](docs/architecture.md)
- [Decisiones de arquitectura](docs/adr/0001-plataforma-y-limites.md)
- [Atomicidad y correcciones](docs/adr/0002-mutaciones-atomicas-y-correcciones.md)
- [Backlog por fases](docs/backlog.md)
- [Entornos y Cloudflare](docs/environments-and-deployment.md)
- [Backup y restauración](docs/runbooks/backup-restore.md)
- [Alta, activación y roles](docs/runbooks/user-provisioning.md)
- [Lanzamiento](docs/runbooks/launch.md)
- [Respuesta a incidentes](docs/runbooks/incident-response.md)

## Automatizaciones

- `CI`: formato, lint, tipos, unitarias, build y Supabase local en PR/main.
- `Desplegar Cloudflare Pages`: preview automático por PR interno y producción automática
  al hacer push a `main`; conserva ejecución manual protegida.
- `E2E de preview`: manual contra el entorno de preview.
- `Backup cifrado diario`: datos, 7 días de retención.
- `Backup cifrado semanal`: roles/esquema/datos, 28 días de retención.
- `Backup cifrado mensual`: completo, ventana de 90 días para exportarlo al archivo
  externo de 12 meses.
- `Backup completo posterior a migración`: ejecución manual tras cada `supabase db push`
  productivo; nunca antes de aplicar la migración remota.

## Despliegue Provisional En Vercel

Sí, se puede publicar una versión provisional en Vercel para que el cliente entre por
una URL y pruebe el mismo software con datos demo.

1. Crear un proyecto Vercel conectado a este repositorio.
2. Configurar `VITE_USE_DUMMY_DATA=true`.
3. Opcionalmente configurar `VITE_APP_ENV=preview`.
4. Usar `pnpm build:demo` como comando de build, o `pnpm build` si el entorno ya inyecta
   `VITE_USE_DUMMY_DATA=true`.
5. Publicar normalmente. El archivo `vercel.json` ya deja resueltas las rutas de SPA
   como `/cuentas`, `/inventario` y `/ventas`.

El modo demo guarda cambios solo en `localStorage` del navegador, así que el cliente
podrá probar la app sin tocar Supabase ni afectar datos reales.

Los backups requieren `SUPABASE_DB_URL` como secreto y
`BACKUP_AGE_RECIPIENT` como variable pública. La clave privada `age` debe conservarse
fuera de GitHub. Antes del lanzamiento es obligatorio ensayar una restauración en un
proyecto desechable.
