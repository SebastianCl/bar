# Runbook de alta, activación y roles

## Objetivo y responsables

El estado inicial obligatorio es **dos administradores activos y al menos un empleado
activo**. Solo un propietario del proyecto Supabase puede ejecutar este procedimiento.
La SPA no recibe permisos para escribir `profiles`: una invitación crea el perfil como
`staff` e inactivo y la activación/promoción se hace desde SQL Editor.

Nunca usar una cuenta productiva como usuario E2E ni crear usuarios desde la SPA.

## 1. Configurar el retorno de Auth

En Supabase Dashboard → Authentication → URL Configuration:

1. Para que **Send invitation** use el flujo de contraseña de la SPA, definir **Site
   URL** con la URL completa
   `https://bar.example.com/auth/callback?next=/restablecer`.
2. Añadir esa misma URL a **Redirect URLs**.
3. Añadir también
   `https://bar.example.com/auth/callback?next=%2Frestablecer`, que es la forma
   codificada emitida por el flujo de recuperación.
4. Repetir con el dominio estable de preview en el proyecto Supabase de preview. No usar
   comodines en producción.

Dashboard usa Site URL cuando una invitación no especifica otro `redirectTo`. Referencias
oficiales: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) y
[administración e invitación de usuarios](https://supabase.com/docs/guides/auth/users#inviting-users).

## 2. Invitar exactamente los tres usuarios iniciales

Preparar los correos, nombres y usuarios únicos de `ADMIN_1`, `ADMIN_2` y `STAFF`.
El usuario debe tener entre 3 y 32 caracteres: letras minúsculas, números, punto,
guion o guion bajo; debe empezar por letra o número. En el proyecto y
entorno correctos:

1. Abrir Supabase Dashboard → Authentication → Users.
2. Elegir **Add user → Send invitation**; ingresar `ADMIN_1_EMAIL` y enviar.
3. Repetir por separado para `ADMIN_2_EMAIL` y `STAFF_EMAIL`.
4. Confirmar que aparecen exactamente las tres filas en Users y copiar sus UUID para la
   evidencia operativa. No usar **Create new user**, porque omite la aceptación por correo.

Una invitación ya aceptada no se reenvía: comprobar primero Users y usar recuperación de
contraseña si corresponde. Si expiró sin aceptarse, reenviar desde Dashboard. La API
administrativa con `inviteUserByEmail` queda como alternativa opcional para una futura
automatización de servidor; no es necesaria para este runbook.

## 3. Activar y asignar dos administradores más staff

Después de que las tres invitaciones hayan creado sus filas en `auth.users`, abrir SQL
Editor en el mismo proyecto, sustituir los seis literales en mayúsculas y ejecutar todo
el bloque como una unidad:

```sql
begin;

create temporary table desired_users (
  email text primary key,
  username text not null unique,
  display_name text not null,
  role public.app_role not null
) on commit drop;

insert into desired_users (email, username, display_name, role)
values
  ('ADMIN_1_EMAIL', 'ADMIN_1_USER', 'ADMIN_1_NAME', 'admin'),
  ('ADMIN_2_EMAIL', 'ADMIN_2_USER', 'ADMIN_2_NAME', 'admin'),
  ('STAFF_EMAIL', 'STAFF_USER', 'STAFF_NAME', 'staff');

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from desired_users as desired
  join auth.users as auth_user
    on lower(auth_user.email) = lower(desired.email);

  if matched <> 3 then
    raise exception 'Se esperaban 3 usuarios invitados; encontrados: %', matched;
  end if;
end
$$;

update public.profiles as profile
set
  display_name = desired.display_name,
  username = lower(desired.username),
  role = desired.role,
  is_active = true
from auth.users as auth_user
join desired_users as desired
  on lower(auth_user.email) = lower(desired.email)
where profile.id = auth_user.id;

do $$
begin
  if (
    select count(*)
    from public.profiles as profile
    join auth.users as auth_user on auth_user.id = profile.id
    join desired_users as desired
      on lower(desired.email) = lower(auth_user.email)
    where profile.is_active and profile.role = desired.role
  ) <> 3 then
    raise exception 'No quedaron activos los 3 perfiles con el rol esperado';
  end if;
end
$$;

select
  auth_user.id,
  auth_user.email,
  auth_user.email_confirmed_at,
  profile.display_name,
  profile.username,
  profile.role,
  profile.is_active
from auth.users as auth_user
join public.profiles as profile on profile.id = auth_user.id
join desired_users as desired
  on lower(desired.email) = lower(auth_user.email)
order by profile.role, auth_user.email;

commit;
```

El resultado debe contener tres filas: dos `admin` activos y un `staff` activo. Si una
validación falla, la transacción se revierte y se corrige la invitación antes de
reintentar. Guardar como evidencia los UUID, correos, roles y fecha; nunca contraseñas o
tokens.

## 4. Aceptación y verificación

Cada persona debe:

1. Abrir su invitación antes de que expire.
2. Confirmar que llega a `/auth/callback?next=/restablecer` y después a
   `/restablecer` con sesión válida.
3. Definir una contraseña única de al menos ocho caracteres y cerrar sesión.
4. Volver a entrar desde `/login` usando el nombre de usuario asignado y su contraseña.

El responsable verifica por separado:

- ambos administradores ven Inventario y pueden crear/editar productos;
- staff puede operar cuentas y consultar Inventario en solo lectura, pero no ve acciones
  para crear, editar o ajustar productos;
- un perfil con `is_active = false` no puede leer datos ni ejecutar RPC;
- al menos dos administradores continúan activos antes de desactivar o degradar uno.

Para preview, crear cuentas dedicadas adicionales para `E2E_USERNAME` y
`E2E_ADMIN_USERNAME`; el workflow E2E exige ambas parejas de credenciales. No reutilizar
ninguno de los tres usuarios operativos de producción.

## 5. Desactivar o corregir un rol

Desde SQL Editor, localizar siempre por UUID y correo antes de modificar:

```sql
select auth_user.id, auth_user.email, profile.role, profile.is_active
from auth.users as auth_user
join public.profiles as profile on profile.id = auth_user.id
where lower(auth_user.email) = lower('USUARIO_EMAIL');

update public.profiles
set is_active = false
where id = 'USUARIO_UUID';
```

Revocar después sus sesiones desde Authentication → Users. Para una promoción, cambiar
`role` a `admin` y conservar `is_active = true`; para una degradación, usar `staff`.
Antes de desactivar o degradar un admin, verificar que queden al menos dos admins activos.
