begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(to_regnamespace('private') is not null, 'private schema exists');

select is(
  (
    select array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as namespace on namespace.oid = enum_type.typnamespace
    where namespace.nspname = 'public'
      and enum_type.typname = 'app_role'
  ),
  array['admin', 'staff']::text[],
  'app_role has only admin and staff'
);

select is(
  (
    select array_agg(table_name::text order by table_name)
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name = any (array[
        'bar_settings',
        'inventory_movements',
        'products',
        'profiles',
        'receipt_items',
        'receipts',
        'tab_items',
        'tabs'
      ])
  ),
  array[
    'bar_settings',
    'inventory_movements',
    'products',
    'profiles',
    'receipt_items',
    'receipts',
    'tab_items',
    'tabs'
  ]::text[],
  'all canonical public tables exist'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
  ),
  array[
    'id', 'sku', 'name', 'current_price', 'stock_quantity', 'is_active',
    'created_by', 'created_at', 'updated_by', 'updated_at'
  ]::text[],
  'products has the canonical columns in order'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tabs'
  ),
  array[
    'id', 'reference_type', 'reference_label', 'status', 'opened_at',
    'opened_by', 'closed_at', 'closed_by', 'cancelled_at', 'cancelled_by',
    'open_request_id', 'created_at', 'updated_at'
  ]::text[],
  'tabs has the canonical columns in order'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tab_items'
  ),
  array[
    'id', 'tab_id', 'product_id', 'quantity', 'product_name_snapshot',
    'sku_snapshot', 'unit_price_snapshot', 'line_total', 'created_by',
    'created_at', 'updated_by', 'updated_at', 'voided_at', 'voided_by',
    'void_reason', 'add_request_id'
  ]::text[],
  'tab_items has the canonical columns in order'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'open_tabs_summary'
  ),
  array[
    'id', 'reference_type', 'reference_label', 'status', 'opened_at',
    'opened_by', 'total', 'item_count'
  ]::text[],
  'open_tabs_summary exposes only its canonical columns'
);

select ok(
  coalesce(
    (
      select 'security_invoker=true' = any (view_class.reloptions)
      from pg_catalog.pg_class as view_class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = view_class.relnamespace
      where namespace.nspname = 'public'
        and view_class.relname = 'open_tabs_summary'
    ),
    false
  ),
  'open_tabs_summary is a security-invoker view'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any (array[
        'open_tab', 'create_product', 'update_product', 'set_stock',
        'add_consumption', 'set_tab_item_quantity', 'void_tab_item',
        'cancel_empty_tab', 'close_tab'
      ])
  ),
  9::bigint,
  'exactly nine public command RPC overloads exist'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any (array[
        'open_tab', 'create_product', 'update_product', 'set_stock',
        'add_consumption', 'set_tab_item_quantity', 'void_tab_item',
        'cancel_empty_tab', 'close_tab'
      ])
      and not procedure.prosecdef
      and procedure.prorettype = 'jsonb'::regtype
  ),
  9::bigint,
  'every exposed RPC is SECURITY INVOKER and returns jsonb'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
  ),
  0::bigint,
  'the exposed schema contains no SECURITY DEFINER function'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = any (array[
        'open_tab', 'create_product', 'update_product', 'set_stock',
        'add_consumption', 'set_tab_item_quantity', 'void_tab_item',
        'cancel_empty_tab', 'close_tab'
      ])
      and procedure.prosecdef
  ),
  9::bigint,
  'the nine private delegates are SECURITY DEFINER'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where procedure.prosecdef
      and namespace.nspname = 'private'
      and exists (
        select 1
        from unnest(procedure.proconfig) as setting(value)
        where setting.value like 'search_path=%'
      )
  ),
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where procedure.prosecdef
      and namespace.nspname = 'private'
  ),
  'every private SECURITY DEFINER pins its search_path'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and relation.relname = any (array[
        'profiles', 'bar_settings', 'products', 'tabs', 'tab_items',
        'inventory_movements', 'receipts', 'receipt_items'
      ])
      and relation.relrowsecurity
  ),
  8::bigint,
  'RLS is enabled on every public base table'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'bar_settings', 'products', 'tabs', 'tab_items',
        'inventory_movements', 'receipts', 'receipt_items'
      ])
      and cmd = 'SELECT'
  ),
  8::bigint,
  'each public table has one read-only RLS policy'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and privilege_type <> 'SELECT'
  ),
  0::bigint,
  'authenticated receives no direct table mutation grant'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema in ('public', 'private')
  ),
  0::bigint,
  'anon receives no table or view grant'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private schema'
);

select ok(
  not has_schema_privilege('anon', 'public', 'USAGE'),
  'anon cannot use the public Data API schema'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any (array[
        'open_tab', 'create_product', 'update_product', 'set_stock',
        'add_consumption', 'set_tab_item_quantity', 'void_tab_item',
        'cancel_empty_tab', 'close_tab'
      ])
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  9::bigint,
  'only authenticated can execute every public command RPC'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = any (array[
        'open_tab', 'create_product', 'update_product', 'set_stock',
        'add_consumption', 'set_tab_item_quantity', 'void_tab_item',
        'cancel_empty_tab', 'close_tab'
      ])
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  9::bigint,
  'private delegates are reachable only by authenticated wrappers'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'products' and column_name in ('created_by', 'updated_by'))
        or (table_name = 'tabs' and column_name = 'opened_by')
        or (table_name = 'tab_items' and column_name in ('created_by', 'updated_by'))
        or (table_name = 'inventory_movements' and column_name = 'actor_id')
        or (table_name = 'receipts' and column_name = 'issued_by')
      )
      and is_nullable = 'NO'
  ),
  7::bigint,
  'operational actor audit fields are non-nullable'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('tab_items', 'receipt_items')
      and column_name = 'line_total'
      and is_generated = 'ALWAYS'
      and numeric_precision = 14
      and numeric_scale = 2
  ),
  2::bigint,
  'line totals are generated numeric(14,2) values'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'tabs'
      and indexdef ilike '%unique%open_request_id%'
  ),
  'open_request_id is unique'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'inventory_movements'
      and indexdef ilike '%unique%request_id%'
  ),
  'each intent creates at most one inventory movement'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'receipt_items'
      and indexdef ilike '%unique%source_tab_item_id%'
  ),
  'a tab item can be snapshotted into only one receipt'
);

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.key_column_usage
    where constraint_schema = 'private'
      and table_name = 'command_requests'
      and constraint_name = 'command_requests_pkey'
  ),
  array['request_id']::text[],
  'request UUID is globally unique in the idempotency registry'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('inventory_movements', 'receipts', 'receipt_items')
      and not trigger.tgisinternal
      and trigger.tgname like '%immutable'
  ),
  3::bigint,
  'all ledger and receipt tables have immutable-row triggers'
);

select * from finish();
rollback;
