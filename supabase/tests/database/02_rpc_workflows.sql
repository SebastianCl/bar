begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select no_plan();

create temporary table test_state (
  key text primary key,
  payload jsonb not null
);
grant all on table test_state to authenticated;

create function pg_temp.set_actor(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

insert into auth.users (
  id,
  email,
  raw_user_meta_data
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin@example.test',
    '{"display_name":"Administradora"}'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'staff@example.test',
    '{"display_name":"Mesera"}'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'inactive@example.test',
    '{"display_name":"Pendiente"}'
  );

select is(
  (select count(*) from public.profiles),
  3::bigint,
  'the auth trigger creates one profile per user'
);

select is(
  (
    select display_name
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'Administradora',
  'the profile trigger accepts only the display name metadata'
);

update public.profiles
set role = 'admin', is_active = true
where id = 'a0000000-0000-0000-0000-000000000001';

update public.profiles
set role = 'staff', is_active = true
where id = 'a0000000-0000-0000-0000-000000000002';

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.open_tab('table', 'Mesa inactiva', '01000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'forbidden',
  'an inactive profile cannot run a command'
);

select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.open_tab('table', 'Mesa anónima', '01000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'unauthenticated',
  'the internal auth guard emits the stable unauthenticated error'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000001');
insert into test_state (key, payload)
select 'create_product', public.create_product(
  'Cerveza',
  'CER-001',
  10000.00,
  20,
  '10000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'create_product'),
  '20',
  'opening stock is returned on product creation'
);

select is(
  (
    select stock_delta
    from public.inventory_movements
    where request_id = '10000000-0000-0000-0000-000000000001'
  ),
  20,
  'product creation records an opening-stock movement'
);

insert into test_state (key, payload)
select 'create_product_replay', public.create_product(
  'Cerveza',
  'CER-001',
  10000.00,
  20,
  '10000000-0000-0000-0000-000000000001'
);

select is(
  (select payload from test_state where key = 'create_product_replay'),
  (select payload from test_state where key = 'create_product'),
  'an identical product request replays the exact response'
);

select is(
  (select count(*) from public.products),
  1::bigint,
  'product replay does not duplicate the product'
);

select throws_ok(
  $$
    select public.create_product(
      'Otra cerveza', 'CER-001', 10000.00, 20,
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  'idempotency_conflict',
  'a globally reused request UUID with another payload is rejected'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$
    select public.create_product(
      'Producto staff', 'STAFF-1', 1.00, 0,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'forbidden',
  'staff cannot manage the product catalog'
);

insert into test_state (key, payload)
select 'tab_one', public.open_tab(
  'table',
  'Mesa 1',
  '20000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{tab,status}' from test_state where key = 'tab_one'),
  'open',
  'staff can open a tab'
);

select throws_ok(
  $$
    select public.open_tab(
      'table', '  mEsA 1  ',
      '20000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'duplicate_open_table',
  'open table references are unique case-insensitively'
);

insert into test_state (key, payload)
select 'add_one', public.add_consumption(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_one'),
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  3,
  '30000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'add_one'),
  '17',
  'adding three units atomically leaves seventeen in stock'
);

select is(
  (select (payload ->> 'total')::numeric from test_state where key = 'add_one'),
  30000.00::numeric,
  'the open-tab total uses the snapshotted unit price'
);

insert into test_state (key, payload)
select 'add_one_replay', public.add_consumption(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_one'),
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  3,
  '30000000-0000-0000-0000-000000000001'
);

select is(
  (select payload from test_state where key = 'add_one_replay'),
  (select payload from test_state where key = 'add_one'),
  'consumption replay returns the exact cached envelope'
);

select is(
  (select count(*) from public.tab_items),
  1::bigint,
  'consumption replay does not duplicate a line item'
);

select throws_ok(
  format(
    'select public.add_consumption(%L::uuid, %L::uuid, 99, %L::uuid)',
    (select payload #>> '{tab,id}' from test_state where key = 'tab_one'),
    (select payload #>> '{product,id}' from test_state where key = 'create_product'),
    '30000000-0000-0000-0000-000000000002'
  ),
  'P0001',
  'out_of_stock',
  'stock cannot become negative'
);

insert into test_state (key, payload)
select 'quantity_five', public.set_tab_item_quantity(
  (select (payload #>> '{item,id}')::uuid from test_state where key = 'add_one'),
  5,
  '40000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'quantity_five'),
  '15',
  'increasing a line quantity consumes only the difference'
);

select is(
  (
    select stock_delta
    from public.inventory_movements
    where request_id = '40000000-0000-0000-0000-000000000001'
  ),
  -2,
  'quantity adjustment records the inventory delta'
);

insert into test_state (key, payload)
select 'quantity_two', public.set_tab_item_quantity(
  (select (payload #>> '{item,id}')::uuid from test_state where key = 'add_one'),
  2,
  '40000000-0000-0000-0000-000000000002'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'quantity_two'),
  '18',
  'decreasing a line from five to two restores three units to stock'
);

select is(
  (
    select stock_delta
    from public.inventory_movements
    where request_id = '40000000-0000-0000-0000-000000000002'
  ),
  3,
  'decreasing a line records the positive inventory return'
);

insert into test_state (key, payload)
select 'void_one', public.void_tab_item(
  (select (payload #>> '{item,id}')::uuid from test_state where key = 'add_one'),
  '50000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'void_one'),
  '20',
  'voiding the reduced line restores its two remaining units'
);

select is(
  (select (payload ->> 'total')::numeric from test_state where key = 'void_one'),
  0::numeric,
  'voided lines do not contribute to the tab total'
);

insert into test_state (key, payload)
select 'cancel_one', public.cancel_empty_tab(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_one'),
  '60000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{tab,status}' from test_state where key = 'cancel_one'),
  'cancelled',
  'a tab with only voided lines can be cancelled'
);

select throws_ok(
  format(
    'select public.add_consumption(%L::uuid, %L::uuid, 1, %L::uuid)',
    (select payload #>> '{tab,id}' from test_state where key = 'tab_one'),
    (select payload #>> '{product,id}' from test_state where key = 'create_product'),
    '60000000-0000-0000-0000-000000000002'
  ),
  'P0001',
  'tab_closed',
  'cancelled tabs reject new consumption'
);

insert into test_state (key, payload)
select 'tab_two', public.open_tab(
  'customer',
  'Ana',
  '70000000-0000-0000-0000-000000000001'
);

insert into test_state (key, payload)
select 'add_two', public.add_consumption(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  2,
  '70000000-0000-0000-0000-000000000002'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000001');
insert into test_state (key, payload)
select 'updated_product', public.update_product(
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  'Cerveza premium',
  'CER-001',
  12000.00,
  true
);

select is(
  (select unit_price_snapshot from public.tab_items where id = (
    select (payload #>> '{item,id}')::uuid from test_state where key = 'add_two'
  )),
  10000.00::numeric,
  'changing the catalog price does not rewrite an existing sale snapshot'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000002');
insert into test_state (key, payload)
select 'payment_partial', public.add_tab_payment(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  5000.00,
  'Andrea',
  '71000000-0000-0000-0000-000000000001'
);

select is(
  (select (payload ->> 'balance')::numeric from test_state where key = 'payment_partial'),
  15000.00::numeric,
  'a partial payment reduces the outstanding balance'
);

insert into test_state (key, payload)
select 'add_after_payment', public.add_consumption(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  1,
  '70000000-0000-0000-0000-000000000003'
);

insert into test_state (key, payload)
select 'payment_partial_replay', public.add_tab_payment(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  5000.00,
  'Andrea',
  '71000000-0000-0000-0000-000000000001'
);

select is(
  (select payload from test_state where key = 'payment_partial_replay'),
  (select payload from test_state where key = 'payment_partial'),
  'payment retries return the cached result without duplicating the payment'
);

select throws_ok(
  format(
    'select public.add_tab_payment(%L::uuid, 26000.00, null, %L::uuid)',
    (select payload #>> '{tab,id}' from test_state where key = 'tab_two'),
    '71000000-0000-0000-0000-000000000002'
  ),
  'P0001',
  'balance_exceeded',
  'a payment cannot exceed the outstanding balance'
);

select throws_ok(
  format(
    'select public.close_tab(%L::uuid, %L::uuid)',
    (select payload #>> '{tab,id}' from test_state where key = 'tab_two'),
    '80000000-0000-0000-0000-000000000001'
  ),
  'P0001',
  'balance_due',
  'a tab with an outstanding balance cannot be closed'
);

insert into test_state (key, payload)
select 'payment_final', public.add_tab_payment(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  25000.00,
  null,
  '71000000-0000-0000-0000-000000000003'
);

select throws_ok(
  format(
    'select public.void_tab_item(%L::uuid, %L::uuid)',
    (select payload #>> '{item,id}' from test_state where key = 'add_two'),
    '71000000-0000-0000-0000-000000000004'
  ),
  'P0001',
  'balance_exceeded',
  'a paid amount cannot exceed the bill after voiding a line'
);

insert into test_state (key, payload)
select 'close_two', public.close_tab(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  '80000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{tab,status}' from test_state where key = 'close_two'),
  'closed',
  'closing a tab sets its terminal state'
);

select is(
  (select (payload #>> '{receipt,total}')::numeric from test_state where key = 'close_two'),
  30000.00::numeric,
  'the receipt total uses historical prices'
);

select is(
  (select jsonb_array_length(payload -> 'items') from test_state where key = 'close_two'),
  2,
  'closing snapshots each active line into receipt_items'
);

insert into test_state (key, payload)
select 'close_two_again', public.close_tab(
  (select (payload #>> '{tab,id}')::uuid from test_state where key = 'tab_two'),
  '80000000-0000-0000-0000-000000000002'
);

select is(
  (select payload #>> '{receipt,id}' from test_state where key = 'close_two_again'),
  (select payload #>> '{receipt,id}' from test_state where key = 'close_two'),
  'a second close intent returns the existing receipt'
);

select is(
  (select count(*) from public.receipts),
  1::bigint,
  'two close intents still create one receipt'
);

select throws_ok(
  format(
    'select public.add_consumption(%L::uuid, %L::uuid, 1, %L::uuid)',
    (select payload #>> '{tab,id}' from test_state where key = 'tab_two'),
    (select payload #>> '{product,id}' from test_state where key = 'create_product'),
    '80000000-0000-0000-0000-000000000003'
  ),
  'P0001',
  'tab_closed',
  'closed tabs reject new consumption'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000001');
insert into test_state (key, payload)
select 'stock_count', public.set_stock(
  (select (payload #>> '{product,id}')::uuid from test_state where key = 'create_product'),
  30,
  'Conteo de cierre',
  '90000000-0000-0000-0000-000000000001'
);

select is(
  (select payload #>> '{product,stock_quantity}' from test_state where key = 'stock_count'),
  '30',
  'an administrator can set counted stock'
);

select throws_ok(
  format(
    'select public.set_stock(%L::uuid, 31, %L, %L::uuid)',
    (select payload #>> '{product,id}' from test_state where key = 'create_product'),
    'Otro conteo',
    '90000000-0000-0000-0000-000000000001'
  ),
  'P0001',
  'idempotency_conflict',
  'a stock request UUID cannot be reused with another counted value'
);

select throws_ok(
  $$update public.inventory_movements set reason = 'altered' where true$$,
  'P0001',
  'forbidden',
  'inventory movements are immutable'
);

select throws_ok(
  $$update public.receipts set total = 0 where true$$,
  'P0001',
  'forbidden',
  'receipt headers are immutable'
);

select throws_ok(
  $$delete from public.receipt_items where true$$,
  'P0001',
  'forbidden',
  'receipt line snapshots are immutable'
);

select throws_ok(
  format(
    'delete from public.products where id = %L::uuid',
    (select payload #>> '{product,id}' from test_state where key = 'create_product')
  ),
  'P0001',
  'forbidden',
  'products are retired rather than deleted'
);

update public.bar_settings set bar_name = 'Nombre nuevo' where id = 1;
select is(
  (select bar_name_snapshot from public.receipts limit 1),
  'Mi Bar',
  'later configuration changes do not rewrite receipt snapshots'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
insert into test_state (key, payload)
select 'active_rls', jsonb_build_object(
  'products', (select count(*) from public.products),
  'receipts', (select count(*) from public.receipts)
);
select throws_ok(
  $$update public.products set stock_quantity = 0 where true$$,
  '42501',
  'permission denied for table products',
  'authenticated clients cannot mutate tables directly'
);
reset role;

select is(
  (select payload #>> '{products}' from test_state where key = 'active_rls'),
  '1',
  'an active staff profile can read inventory through RLS'
);

select pg_temp.set_actor('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
insert into test_state (key, payload)
select 'inactive_rls', jsonb_build_object(
  'products', (select count(*) from public.products),
  'own_profile', (
    select count(*)
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000003'
  )
);
reset role;

select is(
  (select payload #>> '{products}' from test_state where key = 'inactive_rls'),
  '0',
  'an inactive profile sees no business data through RLS'
);

select is(
  (select payload #>> '{own_profile}' from test_state where key = 'inactive_rls'),
  '1',
  'an inactive user can still read the own profile needed by the UI guard'
);

select is(
  (select min(stock_quantity) from public.products),
  30,
  'the workflow never permits negative stock'
);

select * from finish();
rollback;
