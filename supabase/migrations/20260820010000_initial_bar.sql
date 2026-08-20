begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public;
revoke usage on schema public from public, anon;
grant usage on schema public to authenticated, service_role;

do $$
begin
  create type public.app_role as enum ('admin', 'staff');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.reference_type as enum ('table', 'customer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.tab_status as enum ('open', 'closed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.inventory_movement_type as enum (
    'opening_stock',
    'stock_count',
    'sale',
    'sale_quantity_change',
    'sale_void'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'staff',
  is_active boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_display_name_check check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 120
  )
);

create table public.bar_settings (
  id smallint primary key default 1,
  bar_name text not null,
  identification text,
  address text,
  phone text,
  currency text not null default 'COP',
  locale text not null default 'es-CO',
  timezone text not null default 'America/Bogota',
  receipt_prefix text not null default 'REC',
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid references auth.users (id) on delete restrict,
  constraint bar_settings_singleton_check check (id = 1),
  constraint bar_settings_bar_name_check check (
    bar_name = btrim(bar_name)
    and char_length(bar_name) between 1 and 160
  ),
  constraint bar_settings_identification_check check (
    identification is null
    or (
      identification = btrim(identification)
      and char_length(identification) between 1 and 80
    )
  ),
  constraint bar_settings_address_check check (
    address is null
    or (
      address = btrim(address)
      and char_length(address) between 1 and 240
    )
  ),
  constraint bar_settings_phone_check check (
    phone is null
    or (
      phone = btrim(phone)
      and char_length(phone) between 1 and 40
    )
  ),
  constraint bar_settings_currency_check check (currency = 'COP'),
  constraint bar_settings_locale_check check (locale = 'es-CO'),
  constraint bar_settings_timezone_check check (timezone = 'America/Bogota'),
  constraint bar_settings_receipt_prefix_check check (
    receipt_prefix ~ '^[A-Z0-9-]{1,12}$'
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  current_price numeric(14, 2) not null,
  stock_quantity integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default statement_timestamp(),
  constraint products_sku_check check (
    sku is null
    or (
      sku = btrim(sku)
      and char_length(sku) between 1 and 50
    )
  ),
  constraint products_name_check check (
    name = btrim(name)
    and char_length(name) between 1 and 120
  ),
  constraint products_price_check check (current_price >= 0),
  constraint products_stock_check check (stock_quantity >= 0)
);

create unique index products_sku_unique_ci
  on public.products (lower(sku))
  where sku is not null;

create index products_catalog_idx
  on public.products (is_active desc, lower(name));

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  reference_type public.reference_type not null,
  reference_label text not null,
  status public.tab_status not null default 'open',
  opened_at timestamptz not null default statement_timestamp(),
  opened_by uuid not null references auth.users (id) on delete restrict,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  open_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint tabs_reference_label_check check (
    reference_label = btrim(reference_label)
    and char_length(reference_label) between 1 and 100
  ),
  constraint tabs_lifecycle_check check (
    (
      status = 'open'
      and closed_at is null
      and closed_by is null
      and cancelled_at is null
      and cancelled_by is null
    )
    or (
      status = 'closed'
      and closed_at is not null
      and closed_by is not null
      and cancelled_at is null
      and cancelled_by is null
    )
    or (
      status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by is not null
      and closed_at is null
      and closed_by is null
    )
  )
);

create unique index tabs_one_open_table_reference
  on public.tabs (lower(reference_label))
  where reference_type = 'table' and status = 'open';

create index tabs_opened_at_idx
  on public.tabs (opened_at)
  where status = 'open';

create table public.tab_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null,
  product_name_snapshot text not null,
  sku_snapshot text,
  unit_price_snapshot numeric(14, 2) not null,
  line_total numeric(14, 2)
    generated always as (round(unit_price_snapshot * quantity, 2)) stored,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default statement_timestamp(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete restrict,
  void_reason text,
  add_request_id uuid not null unique,
  constraint tab_items_quantity_check check (quantity > 0),
  constraint tab_items_name_snapshot_check check (
    product_name_snapshot = btrim(product_name_snapshot)
    and char_length(product_name_snapshot) between 1 and 120
  ),
  constraint tab_items_sku_snapshot_check check (
    sku_snapshot is null
    or (
      sku_snapshot = btrim(sku_snapshot)
      and char_length(sku_snapshot) between 1 and 50
    )
  ),
  constraint tab_items_price_snapshot_check check (unit_price_snapshot >= 0),
  constraint tab_items_void_reason_check check (
    void_reason is null
    or (
      void_reason = btrim(void_reason)
      and char_length(void_reason) between 1 and 180
    )
  ),
  constraint tab_items_void_state_check check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);

create index tab_items_tab_active_idx
  on public.tab_items (tab_id, created_at, id)
  where voided_at is null;

create index tab_items_product_idx
  on public.tab_items (product_id);

create table public.inventory_movements (
  id bigint generated by default as identity primary key,
  request_id uuid not null unique,
  product_id uuid not null references public.products (id) on delete restrict,
  tab_id uuid references public.tabs (id) on delete restrict,
  tab_item_id uuid references public.tab_items (id) on delete restrict,
  movement_type public.inventory_movement_type not null,
  stock_delta integer not null,
  stock_after integer not null,
  item_quantity_before integer,
  item_quantity_after integer,
  reason text not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint inventory_movements_delta_check check (stock_delta <> 0),
  constraint inventory_movements_stock_after_check check (stock_after >= 0),
  constraint inventory_movements_item_before_check check (
    item_quantity_before is null or item_quantity_before >= 0
  ),
  constraint inventory_movements_item_after_check check (
    item_quantity_after is null or item_quantity_after >= 0
  ),
  constraint inventory_movements_reason_check check (
    reason = btrim(reason)
    and char_length(reason) between 1 and 180
  ),
  constraint inventory_movements_tab_item_check check (
    tab_item_id is null or tab_id is not null
  )
);

create index inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc, id desc);

create index inventory_movements_tab_idx
  on public.inventory_movements (tab_id, id)
  where tab_id is not null;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint not null unique,
  receipt_code text not null unique,
  tab_id uuid not null unique references public.tabs (id) on delete restrict,
  reference_type_snapshot public.reference_type not null,
  reference_label_snapshot text not null,
  bar_name_snapshot text not null,
  bar_identification_snapshot text,
  bar_address_snapshot text,
  bar_phone_snapshot text,
  issued_at timestamptz not null default statement_timestamp(),
  issued_by uuid not null references auth.users (id) on delete restrict,
  total numeric(14, 2) not null,
  currency text not null,
  close_request_id uuid not null unique,
  constraint receipts_number_check check (receipt_number > 0),
  constraint receipts_code_check check (
    receipt_code = btrim(receipt_code)
    and char_length(receipt_code) between 1 and 40
  ),
  constraint receipts_reference_label_check check (
    reference_label_snapshot = btrim(reference_label_snapshot)
    and char_length(reference_label_snapshot) between 1 and 100
  ),
  constraint receipts_bar_name_check check (
    bar_name_snapshot = btrim(bar_name_snapshot)
    and char_length(bar_name_snapshot) between 1 and 160
  ),
  constraint receipts_total_check check (total >= 0),
  constraint receipts_currency_check check (currency = 'COP')
);

create index receipts_issued_at_idx
  on public.receipts (issued_at desc, receipt_number desc);

create table public.receipt_items (
  id bigint generated by default as identity primary key,
  receipt_id uuid not null references public.receipts (id) on delete restrict,
  source_tab_item_id uuid not null unique references public.tab_items (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  product_name_snapshot text not null,
  sku_snapshot text,
  unit_price_snapshot numeric(14, 2) not null,
  quantity integer not null,
  line_total numeric(14, 2)
    generated always as (round(unit_price_snapshot * quantity, 2)) stored,
  constraint receipt_items_name_check check (
    product_name_snapshot = btrim(product_name_snapshot)
    and char_length(product_name_snapshot) between 1 and 120
  ),
  constraint receipt_items_sku_check check (
    sku_snapshot is null
    or (
      sku_snapshot = btrim(sku_snapshot)
      and char_length(sku_snapshot) between 1 and 50
    )
  ),
  constraint receipt_items_price_check check (unit_price_snapshot >= 0),
  constraint receipt_items_quantity_check check (quantity > 0)
);

create index receipt_items_receipt_idx
  on public.receipt_items (receipt_id, id);

create table private.command_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users (id) on delete restrict,
  operation text not null,
  request_payload jsonb not null,
  response jsonb,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  constraint command_requests_operation_check check (
    operation = btrim(operation)
    and char_length(operation) between 1 and 80
  ),
  constraint command_requests_response_state_check check (
    (response is null and completed_at is null)
    or (response is not null and completed_at is not null)
  )
);

create index command_requests_created_idx
  on private.command_requests (created_at);

create table private.receipt_counter (
  singleton_id boolean primary key default true,
  next_number bigint not null default 1,
  constraint receipt_counter_singleton_check check (singleton_id),
  constraint receipt_counter_next_check check (next_number > 0)
);

insert into private.receipt_counter (singleton_id, next_number)
values (true, 1)
on conflict (singleton_id) do nothing;

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

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.reject_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'forbidden';
end;
$$;

create or replace function private.reject_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'forbidden';
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    120
  );

  insert into public.profiles (id, display_name, role, is_active)
  values (new.id, v_display_name, 'staff', false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists bar_settings_touch_updated_at on public.bar_settings;
create trigger bar_settings_touch_updated_at
before update on public.bar_settings
for each row execute function private.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function private.touch_updated_at();

drop trigger if exists tabs_touch_updated_at on public.tabs;
create trigger tabs_touch_updated_at
before update on public.tabs
for each row execute function private.touch_updated_at();

drop trigger if exists tab_items_touch_updated_at on public.tab_items;
create trigger tab_items_touch_updated_at
before update on public.tab_items
for each row execute function private.touch_updated_at();

drop trigger if exists products_reject_delete on public.products;
create trigger products_reject_delete
before delete on public.products
for each row execute function private.reject_delete();

drop trigger if exists tabs_reject_delete on public.tabs;
create trigger tabs_reject_delete
before delete on public.tabs
for each row execute function private.reject_delete();

drop trigger if exists tab_items_reject_delete on public.tab_items;
create trigger tab_items_reject_delete
before delete on public.tab_items
for each row execute function private.reject_delete();

drop trigger if exists inventory_movements_immutable on public.inventory_movements;
create trigger inventory_movements_immutable
before update or delete on public.inventory_movements
for each row execute function private.reject_ledger_mutation();

drop trigger if exists receipts_immutable on public.receipts;
create trigger receipts_immutable
before update or delete on public.receipts
for each row execute function private.reject_ledger_mutation();

drop trigger if exists receipt_items_immutable on public.receipt_items;
create trigger receipt_items_immutable
before update or delete on public.receipt_items
for each row execute function private.reject_ledger_mutation();

drop trigger if exists bar_profile_on_auth_user_created on auth.users;
create trigger bar_profile_on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles (id, display_name, role, is_active)
select
  users.id,
  left(
    coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'Usuario'
    ),
    120
  ),
  'staff'::public.app_role,
  false
from auth.users as users
on conflict (id) do nothing;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.is_active
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role = 'admin'
  );
$$;

create or replace function private.require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_actor_id
      and profile.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  return v_actor_id;
end;
$$;

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_user();

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_actor_id
      and profile.role = 'admin'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  return v_actor_id;
end;
$$;

create or replace function private.claim_command(
  p_actor_id uuid,
  p_operation text,
  p_request_id uuid,
  p_request_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stored_actor_id uuid;
  v_stored_operation text;
  v_stored_payload jsonb;
  v_stored_response jsonb;
begin
  if p_request_id is null or p_request_payload is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'request_id_required';
  end if;

  insert into private.command_requests (
    request_id,
    actor_id,
    operation,
    request_payload
  )
  values (
    p_request_id,
    p_actor_id,
    p_operation,
    p_request_payload
  )
  on conflict (request_id) do nothing;

  select
    request.actor_id,
    request.operation,
    request.request_payload,
    request.response
  into
    v_stored_actor_id,
    v_stored_operation,
    v_stored_payload,
    v_stored_response
  from private.command_requests as request
  where request.request_id = p_request_id
  for update;

  if v_stored_actor_id is distinct from p_actor_id
     or v_stored_operation is distinct from p_operation
     or v_stored_payload is distinct from p_request_payload then
    raise exception using
      errcode = 'P0001',
      message = 'idempotency_conflict';
  end if;

  return v_stored_response;
end;
$$;

create or replace function private.complete_command(
  p_actor_id uuid,
  p_operation text,
  p_request_id uuid,
  p_response jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_response is null then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;

  update private.command_requests as request
  set
    response = p_response,
    completed_at = statement_timestamp()
  where request.actor_id = p_actor_id
    and request.operation = p_operation
    and request.request_id = p_request_id
    and request.response is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;
end;
$$;

create or replace function private.current_tab_total(p_tab_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(item.line_total), 0)
  from public.tab_items as item
  where item.tab_id = p_tab_id
    and item.voided_at is null;
$$;

create or replace function private.open_tab(
  p_reference_type text,
  p_reference_label text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_reference_type public.reference_type;
  v_reference_label text;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  case lower(btrim(p_reference_type))
    when 'table' then v_reference_type := 'table';
    when 'customer' then v_reference_type := 'customer';
    else
      raise exception using
        errcode = 'P0001',
        message = 'validation',
        detail = 'reference_type_invalid';
  end case;

  v_reference_label := btrim(p_reference_label);
  if v_reference_label is null
     or char_length(v_reference_label) not between 1 and 100 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'reference_label_invalid';
  end if;

  v_payload := jsonb_build_object(
    'reference_type', v_reference_type::text,
    'reference_label', v_reference_label
  );
  v_cached := private.claim_command(
    v_actor_id,
    'open_tab',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  begin
    insert into public.tabs (
      reference_type,
      reference_label,
      opened_by,
      open_request_id
    )
    values (
      v_reference_type,
      v_reference_label,
      v_actor_id,
      p_request_id
    )
    returning * into v_tab;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'duplicate_open_table';
  end;

  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab)
  );
  perform private.complete_command(
    v_actor_id,
    'open_tab',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.create_product(
  p_name text,
  p_sku text,
  p_price numeric,
  p_opening_stock integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_name text := btrim(p_name);
  v_sku text := nullif(btrim(p_sku), '');
  v_payload jsonb;
  v_cached jsonb;
  v_product public.products%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_movement_json jsonb := 'null'::jsonb;
  v_response jsonb;
begin
  v_actor_id := private.require_admin();

  if v_name is null or char_length(v_name) not between 1 and 120 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_name_invalid';
  end if;
  if v_sku is not null and char_length(v_sku) > 50 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'sku_invalid';
  end if;
  if p_price is null
     or p_price < 0
     or p_price > 999999999999.99
     or p_price <> round(p_price, 2) then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'price_invalid';
  end if;
  if p_opening_stock is null
     or p_opening_stock < 0
     or p_opening_stock > 1000000000 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'opening_stock_invalid';
  end if;

  v_payload := jsonb_build_object(
    'name', v_name,
    'sku', v_sku,
    'price', p_price,
    'opening_stock', p_opening_stock
  );
  v_cached := private.claim_command(
    v_actor_id,
    'create_product',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  begin
    insert into public.products (
      name,
      sku,
      current_price,
      stock_quantity,
      created_by,
      updated_by
    )
    values (
      v_name,
      v_sku,
      p_price,
      p_opening_stock,
      v_actor_id,
      v_actor_id
    )
    returning * into v_product;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'validation',
        detail = 'duplicate_sku';
  end;

  if p_opening_stock > 0 then
    insert into public.inventory_movements (
      request_id,
      product_id,
      movement_type,
      stock_delta,
      stock_after,
      reason,
      actor_id
    )
    values (
      p_request_id,
      v_product.id,
      'opening_stock',
      p_opening_stock,
      p_opening_stock,
      'opening_stock',
      v_actor_id
    )
    returning * into v_movement;
    v_movement_json := to_jsonb(v_movement);
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'product', to_jsonb(v_product),
    'movement', v_movement_json
  );
  perform private.complete_command(
    v_actor_id,
    'create_product',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.update_product(
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_price numeric,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_name text := btrim(p_name);
  v_sku text := nullif(btrim(p_sku), '');
  v_product public.products%rowtype;
begin
  v_actor_id := private.require_admin();

  if p_product_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_id_required';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 120 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_name_invalid';
  end if;
  if v_sku is not null and char_length(v_sku) > 50 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'sku_invalid';
  end if;
  if p_price is null
     or p_price < 0
     or p_price > 999999999999.99
     or p_price <> round(p_price, 2) then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'price_invalid';
  end if;
  if p_is_active is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'is_active_required';
  end if;

  perform 1
  from public.products as product
  where product.id = p_product_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_not_found';
  end if;

  begin
    update public.products as product
    set
      name = v_name,
      sku = v_sku,
      current_price = p_price,
      is_active = p_is_active,
      updated_by = v_actor_id
    where product.id = p_product_id
    returning * into v_product;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'validation',
        detail = 'duplicate_sku';
  end;

  return jsonb_build_object(
    'ok', true,
    'product', to_jsonb(v_product)
  );
end;
$$;

create or replace function private.set_stock(
  p_product_id uuid,
  p_counted_quantity integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_reason text := btrim(p_reason);
  v_payload jsonb;
  v_cached jsonb;
  v_product public.products%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_movement_json jsonb := 'null'::jsonb;
  v_delta integer;
  v_response jsonb;
begin
  v_actor_id := private.require_admin();

  if p_product_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_id_required';
  end if;
  if p_counted_quantity is null
     or p_counted_quantity < 0
     or p_counted_quantity > 1000000000 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'counted_quantity_invalid';
  end if;
  if v_reason is null or char_length(v_reason) not between 1 and 180 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'reason_invalid';
  end if;

  v_payload := jsonb_build_object(
    'product_id', p_product_id,
    'counted_quantity', p_counted_quantity,
    'reason', v_reason
  );
  v_cached := private.claim_command(
    v_actor_id,
    'set_stock',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select product.*
  into v_product
  from public.products as product
  where product.id = p_product_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_not_found';
  end if;

  v_delta := p_counted_quantity - v_product.stock_quantity;
  if v_delta <> 0 then
    update public.products as product
    set
      stock_quantity = p_counted_quantity,
      updated_by = v_actor_id
    where product.id = p_product_id
    returning * into v_product;

    insert into public.inventory_movements (
      request_id,
      product_id,
      movement_type,
      stock_delta,
      stock_after,
      reason,
      actor_id
    )
    values (
      p_request_id,
      p_product_id,
      'stock_count',
      v_delta,
      p_counted_quantity,
      v_reason,
      v_actor_id
    )
    returning * into v_movement;
    v_movement_json := to_jsonb(v_movement);
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'product', to_jsonb(v_product),
    'movement', v_movement_json
  );
  perform private.complete_command(
    v_actor_id,
    'set_stock',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.add_consumption(
  p_tab_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_product public.products%rowtype;
  v_item public.tab_items%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_total numeric;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  if p_tab_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_id_required';
  end if;
  if p_product_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_id_required';
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000000 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'quantity_invalid';
  end if;

  v_payload := jsonb_build_object(
    'tab_id', p_tab_id,
    'product_id', p_product_id,
    'quantity', p_quantity
  );
  v_cached := private.claim_command(
    v_actor_id,
    'add_consumption',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select tab.*
  into v_tab
  from public.tabs as tab
  where tab.id = p_tab_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_not_found';
  end if;
  if v_tab.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tab_closed';
  end if;

  select product.*
  into v_product
  from public.products as product
  where product.id = p_product_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_not_found';
  end if;
  if not v_product.is_active then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_inactive';
  end if;
  if v_product.current_price * p_quantity > 999999999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'line_total_too_large';
  end if;
  if v_product.stock_quantity < p_quantity then
    raise exception using errcode = 'P0001', message = 'out_of_stock';
  end if;

  update public.products as product
  set
    stock_quantity = product.stock_quantity - p_quantity,
    updated_by = v_actor_id
  where product.id = p_product_id
  returning * into v_product;

  insert into public.tab_items (
    tab_id,
    product_id,
    quantity,
    product_name_snapshot,
    sku_snapshot,
    unit_price_snapshot,
    created_by,
    updated_by,
    add_request_id
  )
  values (
    p_tab_id,
    p_product_id,
    p_quantity,
    v_product.name,
    v_product.sku,
    v_product.current_price,
    v_actor_id,
    v_actor_id,
    p_request_id
  )
  returning * into v_item;

  insert into public.inventory_movements (
    request_id,
    product_id,
    tab_id,
    tab_item_id,
    movement_type,
    stock_delta,
    stock_after,
    item_quantity_before,
    item_quantity_after,
    reason,
    actor_id
  )
  values (
    p_request_id,
    p_product_id,
    p_tab_id,
    v_item.id,
    'sale',
    -p_quantity,
    v_product.stock_quantity,
    0,
    p_quantity,
    'sale',
    v_actor_id
  )
  returning * into v_movement;

  update public.tabs as tab
  set updated_at = statement_timestamp()
  where tab.id = p_tab_id
  returning * into v_tab;

  v_total := private.current_tab_total(p_tab_id);
  if v_total > 999999999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_total_too_large';
  end if;
  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab),
    'item', to_jsonb(v_item),
    'product', to_jsonb(v_product),
    'movement', to_jsonb(v_movement),
    'total', v_total
  );
  perform private.complete_command(
    v_actor_id,
    'add_consumption',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.set_tab_item_quantity(
  p_item_id uuid,
  p_new_quantity integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_product public.products%rowtype;
  v_item public.tab_items%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_movement_json jsonb := 'null'::jsonb;
  v_quantity_delta integer;
  v_stock_delta integer;
  v_total numeric;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  if p_item_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_id_required';
  end if;
  if p_new_quantity is null or p_new_quantity not between 1 and 1000000 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'quantity_invalid';
  end if;

  v_payload := jsonb_build_object(
    'item_id', p_item_id,
    'new_quantity', p_new_quantity
  );
  v_cached := private.claim_command(
    v_actor_id,
    'set_tab_item_quantity',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select item.*
  into v_item
  from public.tab_items as item
  where item.id = p_item_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_not_found';
  end if;
  if v_item.voided_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_voided';
  end if;

  select tab.*
  into v_tab
  from public.tabs as tab
  where tab.id = v_item.tab_id
  for update;
  if v_tab.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tab_closed';
  end if;

  select product.*
  into v_product
  from public.products as product
  where product.id = v_item.product_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;

  if v_item.unit_price_snapshot * p_new_quantity > 999999999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'line_total_too_large';
  end if;

  v_quantity_delta := p_new_quantity - v_item.quantity;
  v_stock_delta := -v_quantity_delta;
  if v_quantity_delta > 0 and not v_product.is_active then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'product_inactive';
  end if;
  if v_quantity_delta > 0 and v_product.stock_quantity < v_quantity_delta then
    raise exception using errcode = 'P0001', message = 'out_of_stock';
  end if;

  if v_quantity_delta <> 0 then
    update public.products as product
    set
      stock_quantity = product.stock_quantity + v_stock_delta,
      updated_by = v_actor_id
    where product.id = v_product.id
    returning * into v_product;

    update public.tab_items as item
    set
      quantity = p_new_quantity,
      updated_by = v_actor_id
    where item.id = p_item_id
    returning * into v_item;

    insert into public.inventory_movements (
      request_id,
      product_id,
      tab_id,
      tab_item_id,
      movement_type,
      stock_delta,
      stock_after,
      item_quantity_before,
      item_quantity_after,
      reason,
      actor_id
    )
    values (
      p_request_id,
      v_product.id,
      v_tab.id,
      v_item.id,
      'sale_quantity_change',
      v_stock_delta,
      v_product.stock_quantity,
      v_item.quantity - v_quantity_delta,
      v_item.quantity,
      'quantity_changed',
      v_actor_id
    )
    returning * into v_movement;
    v_movement_json := to_jsonb(v_movement);

    update public.tabs as tab
    set updated_at = statement_timestamp()
    where tab.id = v_tab.id
    returning * into v_tab;
  end if;

  v_total := private.current_tab_total(v_tab.id);
  if v_total > 999999999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_total_too_large';
  end if;
  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab),
    'item', to_jsonb(v_item),
    'product', to_jsonb(v_product),
    'movement', v_movement_json,
    'total', v_total
  );
  perform private.complete_command(
    v_actor_id,
    'set_tab_item_quantity',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.void_tab_item(
  p_item_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_product public.products%rowtype;
  v_item public.tab_items%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_total numeric;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  if p_item_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_id_required';
  end if;

  v_payload := jsonb_build_object('item_id', p_item_id);
  v_cached := private.claim_command(
    v_actor_id,
    'void_tab_item',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select item.*
  into v_item
  from public.tab_items as item
  where item.id = p_item_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_not_found';
  end if;
  if v_item.voided_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'item_voided';
  end if;

  select tab.*
  into v_tab
  from public.tabs as tab
  where tab.id = v_item.tab_id
  for update;
  if v_tab.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tab_closed';
  end if;

  select product.*
  into v_product
  from public.products as product
  where product.id = v_item.product_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;

  update public.products as product
  set
    stock_quantity = product.stock_quantity + v_item.quantity,
    updated_by = v_actor_id
  where product.id = v_product.id
  returning * into v_product;

  update public.tab_items as item
  set
    voided_at = statement_timestamp(),
    voided_by = v_actor_id,
    void_reason = 'voided',
    updated_by = v_actor_id
  where item.id = p_item_id
  returning * into v_item;

  insert into public.inventory_movements (
    request_id,
    product_id,
    tab_id,
    tab_item_id,
    movement_type,
    stock_delta,
    stock_after,
    item_quantity_before,
    item_quantity_after,
    reason,
    actor_id
  )
  values (
    p_request_id,
    v_product.id,
    v_tab.id,
    v_item.id,
    'sale_void',
    v_item.quantity,
    v_product.stock_quantity,
    v_item.quantity,
    0,
    'voided',
    v_actor_id
  )
  returning * into v_movement;

  update public.tabs as tab
  set updated_at = statement_timestamp()
  where tab.id = v_tab.id
  returning * into v_tab;

  v_total := private.current_tab_total(v_tab.id);
  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab),
    'item', to_jsonb(v_item),
    'product', to_jsonb(v_product),
    'movement', to_jsonb(v_movement),
    'total', v_total
  );
  perform private.complete_command(
    v_actor_id,
    'void_tab_item',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.cancel_empty_tab(
  p_tab_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  if p_tab_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_id_required';
  end if;

  v_payload := jsonb_build_object('tab_id', p_tab_id);
  v_cached := private.claim_command(
    v_actor_id,
    'cancel_empty_tab',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select tab.*
  into v_tab
  from public.tabs as tab
  where tab.id = p_tab_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_not_found';
  end if;
  if v_tab.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tab_closed';
  end if;
  if exists (
    select 1
    from public.tab_items as item
    where item.tab_id = p_tab_id
      and item.voided_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_not_empty';
  end if;

  update public.tabs as tab
  set
    status = 'cancelled',
    cancelled_at = statement_timestamp(),
    cancelled_by = v_actor_id
  where tab.id = p_tab_id
  returning * into v_tab;

  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab)
  );
  perform private.complete_command(
    v_actor_id,
    'cancel_empty_tab',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function private.close_tab(
  p_tab_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_payload jsonb;
  v_cached jsonb;
  v_tab public.tabs%rowtype;
  v_settings public.bar_settings%rowtype;
  v_receipt public.receipts%rowtype;
  v_receipt_number bigint;
  v_receipt_code text;
  v_item_count bigint;
  v_total numeric;
  v_items jsonb;
  v_response jsonb;
begin
  v_actor_id := private.require_active_user();

  if p_tab_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_id_required';
  end if;

  v_payload := jsonb_build_object('tab_id', p_tab_id);
  v_cached := private.claim_command(
    v_actor_id,
    'close_tab',
    p_request_id,
    v_payload
  );
  if v_cached is not null then
    return v_cached;
  end if;

  select tab.*
  into v_tab
  from public.tabs as tab
  where tab.id = p_tab_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_not_found';
  end if;
  if v_tab.status = 'closed' then
    select receipt.*
    into v_receipt
    from public.receipts as receipt
    where receipt.tab_id = v_tab.id;
    if not found then
      raise exception using errcode = 'P0001', message = 'unknown';
    end if;

    select coalesce(
      jsonb_agg(to_jsonb(item) order by item.id),
      '[]'::jsonb
    )
    into v_items
    from public.receipt_items as item
    where item.receipt_id = v_receipt.id;

    v_response := jsonb_build_object(
      'ok', true,
      'tab', to_jsonb(v_tab),
      'receipt', to_jsonb(v_receipt),
      'items', v_items
    );
    perform private.complete_command(
      v_actor_id,
      'close_tab',
      p_request_id,
      v_response
    );
    return v_response;
  elsif v_tab.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tab_closed';
  end if;

  select count(*), coalesce(sum(item.line_total), 0)
  into v_item_count, v_total
  from public.tab_items as item
  where item.tab_id = p_tab_id
    and item.voided_at is null;
  if v_item_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_empty';
  end if;
  if v_total > 999999999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'validation',
      detail = 'tab_total_too_large';
  end if;

  select settings.*
  into v_settings
  from public.bar_settings as settings
  where settings.id = 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;

  update private.receipt_counter as counter
  set next_number = counter.next_number + 1
  where counter.singleton_id
  returning counter.next_number - 1 into v_receipt_number;
  if not found then
    raise exception using errcode = 'P0001', message = 'unknown';
  end if;

  v_receipt_code := v_settings.receipt_prefix
    || '-'
    || lpad(v_receipt_number::text, 8, '0');

  insert into public.receipts (
    receipt_number,
    receipt_code,
    tab_id,
    reference_type_snapshot,
    reference_label_snapshot,
    bar_name_snapshot,
    bar_identification_snapshot,
    bar_address_snapshot,
    bar_phone_snapshot,
    issued_by,
    total,
    currency,
    close_request_id
  )
  values (
    v_receipt_number,
    v_receipt_code,
    v_tab.id,
    v_tab.reference_type,
    v_tab.reference_label,
    v_settings.bar_name,
    v_settings.identification,
    v_settings.address,
    v_settings.phone,
    v_actor_id,
    v_total,
    v_settings.currency,
    p_request_id
  )
  returning * into v_receipt;

  insert into public.receipt_items (
    receipt_id,
    source_tab_item_id,
    product_id,
    product_name_snapshot,
    sku_snapshot,
    unit_price_snapshot,
    quantity
  )
  select
    v_receipt.id,
    item.id,
    item.product_id,
    item.product_name_snapshot,
    item.sku_snapshot,
    item.unit_price_snapshot,
    item.quantity
  from public.tab_items as item
  where item.tab_id = p_tab_id
    and item.voided_at is null
  order by item.created_at, item.id;

  update public.tabs as tab
  set
    status = 'closed',
    closed_at = v_receipt.issued_at,
    closed_by = v_actor_id
  where tab.id = p_tab_id
  returning * into v_tab;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.id),
    '[]'::jsonb
  )
  into v_items
  from public.receipt_items as item
  where item.receipt_id = v_receipt.id;

  v_response := jsonb_build_object(
    'ok', true,
    'tab', to_jsonb(v_tab),
    'receipt', to_jsonb(v_receipt),
    'items', v_items
  );
  perform private.complete_command(
    v_actor_id,
    'close_tab',
    p_request_id,
    v_response
  );
  return v_response;
end;
$$;

create or replace function public.open_tab(
  p_reference_type text,
  p_reference_label text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.open_tab(
    p_reference_type,
    p_reference_label,
    p_request_id
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.create_product(
  p_name text,
  p_sku text,
  p_price numeric,
  p_opening_stock integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_product(
    p_name,
    p_sku,
    p_price,
    p_opening_stock,
    p_request_id
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.update_product(
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_price numeric,
  p_is_active boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.update_product(
    p_product_id,
    p_name,
    p_sku,
    p_price,
    p_is_active
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.set_stock(
  p_product_id uuid,
  p_counted_quantity integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.set_stock(
    p_product_id,
    p_counted_quantity,
    p_reason,
    p_request_id
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.add_consumption(
  p_tab_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.add_consumption(
    p_tab_id,
    p_product_id,
    p_quantity,
    p_request_id
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.set_tab_item_quantity(
  p_item_id uuid,
  p_new_quantity integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.set_tab_item_quantity(
    p_item_id,
    p_new_quantity,
    p_request_id
  );
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.void_tab_item(
  p_item_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.void_tab_item(p_item_id, p_request_id);
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.cancel_empty_tab(
  p_tab_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.cancel_empty_tab(p_tab_id, p_request_id);
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.close_tab(
  p_tab_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.close_tab(p_tab_id, p_request_id);
exception
  when others then
    if sqlerrm = any (array[
      'validation', 'unauthenticated', 'forbidden', 'out_of_stock',
      'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'unknown'
    ]::text[]) then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace view public.open_tabs_summary
with (security_invoker = true)
as
select
  tab.id,
  tab.reference_type,
  tab.reference_label,
  tab.status,
  tab.opened_at,
  tab.opened_by,
  coalesce(
    sum(item.line_total) filter (where item.voided_at is null),
    0
  )::numeric(14, 2) as total,
  count(item.id) filter (where item.voided_at is null) as item_count
from public.tabs as tab
left join public.tab_items as item on item.tab_id = tab.id
where tab.status = 'open'
group by
  tab.id,
  tab.reference_type,
  tab.reference_label,
  tab.status,
  tab.opened_at,
  tab.opened_by;

alter table public.profiles enable row level security;
alter table public.bar_settings enable row level security;
alter table public.products enable row level security;
alter table public.tabs enable row level security;
alter table public.tab_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table private.command_requests enable row level security;
alter table private.receipt_counter enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists bar_settings_select_active on public.bar_settings;
create policy bar_settings_select_active
on public.bar_settings
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists products_select_active on public.products;
create policy products_select_active
on public.products
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists tabs_select_active on public.tabs;
create policy tabs_select_active
on public.tabs
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists tab_items_select_active on public.tab_items;
create policy tab_items_select_active
on public.tab_items
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists inventory_movements_select_active
  on public.inventory_movements;
create policy inventory_movements_select_active
on public.inventory_movements
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists receipts_select_active on public.receipts;
create policy receipts_select_active
on public.receipts
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists receipt_items_select_active on public.receipt_items;
create policy receipt_items_select_active
on public.receipt_items
for select
to authenticated
using ((select private.is_active_user()));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on table
  public.profiles,
  public.bar_settings,
  public.products,
  public.tabs,
  public.tab_items,
  public.inventory_movements,
  public.receipts,
  public.receipt_items,
  public.open_tabs_summary
to authenticated;

-- The private schema is omitted from api.schemas. These narrowly scoped grants
-- only allow the public SECURITY INVOKER wrappers to reach their delegates.
grant usage on schema private to authenticated;
grant execute on function private.open_tab(text, text, uuid)
  to authenticated;
grant execute on function private.create_product(text, text, numeric, integer, uuid)
  to authenticated;
grant execute on function private.update_product(uuid, text, text, numeric, boolean)
  to authenticated;
grant execute on function private.set_stock(uuid, integer, text, uuid)
  to authenticated;
grant execute on function private.add_consumption(uuid, uuid, integer, uuid)
  to authenticated;
grant execute on function private.set_tab_item_quantity(uuid, integer, uuid)
  to authenticated;
grant execute on function private.void_tab_item(uuid, uuid)
  to authenticated;
grant execute on function private.cancel_empty_tab(uuid, uuid)
  to authenticated;
grant execute on function private.close_tab(uuid, uuid)
  to authenticated;
grant execute on function private.is_active_user(), private.is_admin()
  to authenticated;

grant execute on function public.open_tab(text, text, uuid)
  to authenticated;
grant execute on function public.create_product(text, text, numeric, integer, uuid)
  to authenticated;
grant execute on function public.update_product(uuid, text, text, numeric, boolean)
  to authenticated;
grant execute on function public.set_stock(uuid, integer, text, uuid)
  to authenticated;
grant execute on function public.add_consumption(uuid, uuid, integer, uuid)
  to authenticated;
grant execute on function public.set_tab_item_quantity(uuid, integer, uuid)
  to authenticated;
grant execute on function public.void_tab_item(uuid, uuid)
  to authenticated;
grant execute on function public.cancel_empty_tab(uuid, uuid)
  to authenticated;
grant execute on function public.close_tab(uuid, uuid)
  to authenticated;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema private
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

comment on schema private is
  'Internal implementation schema. Never add it to the Data API exposed schemas.';
comment on table private.command_requests is
  'Global idempotency registry. A request UUID is bound to one actor, operation and canonical payload.';
comment on table public.receipts is
  'Immutable non-fiscal receipt snapshot created when a tab closes.';
comment on column public.receipts.receipt_code is
  'Operational receipt identifier; it is not a tax invoice number.';

commit;
