-- Safe, non-secret defaults only. Replace these values in the Supabase SQL
-- editor after promoting the first user to administrator.
insert into public.bar_settings (
  id,
  bar_name,
  currency,
  locale,
  timezone,
  receipt_prefix
)
values (
  1,
  'Mi Bar',
  'COP',
  'es-CO',
  'America/Bogota',
  'REC'
)
on conflict (id) do nothing;
