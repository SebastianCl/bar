# Entornos y despliegue en Cloudflare Pages

## Estrategia

El repositorio usa `development`, `preview` y `production`. Preview y producción deben
tener proyectos Supabase distintos. Las claves publicables llegan al bundle del
navegador; nunca se configura `service_role` ni una conexión PostgreSQL como variable
`VITE_*`.

| Entorno    | GitHub Environment | Supabase                 | Uso            |
| ---------- | ------------------ | ------------------------ | -------------- |
| Local      | ninguno            | proyecto local o preview | desarrollo     |
| Preview    | `preview`          | proyecto de preview      | UAT/E2E        |
| Producción | `production`       | proyecto productivo      | operación real |

## Preparación de Cloudflare

1. Crear un proyecto **Pages / Direct Upload**. Esta modalidad no puede convertirse
   después a Git integration sin crear otro proyecto.
2. Crear un API token de Cloudflare limitado a la cuenta y con permiso de edición de
   Pages.
3. En GitHub, crear los Environments `preview` y `production`; en producción habilitar
   revisores requeridos. Mantener secretos, proyecto Supabase y proyecto Pages separados
   por Environment.
4. Definir en cada Environment:

   - secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
   - secretos `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto correcto;
     la clave debe empezar exactamente por `sb_publishable_` o el deploy falla antes de
     construir;
   - variable `CLOUDFLARE_PAGES_PROJECT`, igual al proyecto Pages de ese Environment.

5. Opcionalmente definir `PLAYWRIGHT_BASE_URL` en el Environment `preview` con la URL
   estable de la rama preview. Configurar dos usuarios exclusivos de prueba, nunca de
   producción:

   - `E2E_EMAIL` y `E2E_PASSWORD`: empleado sin privilegios administrativos para el
     smoke de inicio de sesión;
   - `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`: administrador de preview para crear un
     producto único con stock 20, abrir una cuenta única, validar consumo, inventario y
     total al pasar de 3 a 5 unidades, cerrar, comprobar el recibo e invocar impresión.

   Localmente, sin `E2E_REQUIRE_ENV=1`, Playwright omite solamente el flujo cuya pareja
   falte. El workflow define `E2E_REQUIRE_ENV=1` y falla si falta cualquier credencial de
   staff o admin. El flujo administrativo deja datos cerrados e inmutables con
   identificadores únicos; se debe limpiar preview periódicamente, nunca apuntarlo a
   producción.

6. Seguir el [runbook de usuarios](runbooks/user-provisioning.md) en ambos proyectos
   Supabase. El redirect de invitación/recuperación debe incluir
   `/auth/callback?next=/restablecer`.

La configuración se basa en el flujo oficial de [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
y en [Wrangler Action](https://github.com/cloudflare/wrangler-action). Cloudflare sirve
automáticamente el fallback de una SPA si no existe un `404.html` superior.

## Despliegue

1. Abrir o actualizar un PR interno: despliega automáticamente a `preview` usando el SHA
   del head y el nombre real de su rama Cloudflare. Los PR desde forks no reciben secretos
   y el job de deploy se omite.
2. Ejecutar UAT y el workflow **E2E de preview**. Los smoke cubren `360×800`, `768×1024`
   y `1440×900`; el flujo admin corre en `1440×900` y prueba dos `close_tab` paralelos.
3. Fusionar únicamente con CI y revisión aprobados.
4. Un push a `main` despliega automáticamente a `production` con el Environment y la
   rama Cloudflare `main`; sus revisores deben aprobar si están configurados.
5. Confirmar inicio de sesión, inventario y lectura del historial sin crear una venta de
   prueba permanente en producción.

La ejecución manual sigue disponible para preview y redeploys controlados. Elegir
`production` desde cualquier ref distinta de `refs/heads/main` hace fallar el job de
protección antes de acceder al Environment. Un preview manual lanzado desde `main` se
publica como rama Cloudflare `preview`, nunca como `main`. El workflow siempre
reconstruye el código, ejecuta formato/lint/tipos/pruebas y publica `dist/`.

## Barreras de seguridad

- Comparar los `PROJECT_REF` de ambas URLs antes del primer lanzamiento.
- No copiar secretos entre Environments mediante texto o logs.
- Restringir quién puede aprobar producción.
- Proteger `main`, exigir CI y no permitir pushes directos no revisados.
- Rotar el token Cloudflare si un colaborador pierde acceso.
- Un rollback del frontend no revierte migraciones; las migraciones deben ser compatibles
  con la versión anterior durante el despliegue.

## Rollback

En Cloudflare Pages → Deployments, seleccionar el último despliegue conocido y usar
Rollback. Si la incidencia incluye base de datos, detener el despliegue y seguir
[respuesta a incidentes](runbooks/incident-response.md); no restaurar un backup como
primer reflejo.
