begin;

create table public.tab_payments (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete restrict,
  amount numeric(14, 2) not null,
  payer_name text,
  request_id uuid not null unique,
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint tab_payments_amount_check check (amount > 0),
  constraint tab_payments_payer_name_check check (
    payer_name is null or (payer_name = btrim(payer_name) and char_length(payer_name) between 1 and 100)
  )
);

create index tab_payments_tab_created_idx on public.tab_payments (tab_id, created_at);
alter table public.tab_payments enable row level security;

create policy tab_payments_select_active on public.tab_payments
for select to authenticated using ((select private.is_active_user()));

create trigger tab_payments_immutable
before update or delete on public.tab_payments
for each row execute function private.reject_ledger_mutation();

create or replace function private.add_tab_payment(
  p_tab_id uuid,
  p_amount numeric,
  p_payer_name text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_tab public.tabs%rowtype;
  v_payment public.tab_payments%rowtype;
  v_payload jsonb;
  v_cached jsonb;
  v_total numeric;
  v_paid numeric;
  v_response jsonb;
  v_payer_name text := nullif(btrim(p_payer_name), '');
begin
  v_actor_id := private.require_active_user();
  if p_tab_id is null or p_request_id is null or p_amount is null
     or p_amount <= 0 or p_amount > 999999999999.99
     or p_amount <> round(p_amount, 2)
     or (v_payer_name is not null and char_length(v_payer_name) > 100) then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;

  v_payload := jsonb_build_object('tab_id', p_tab_id, 'amount', p_amount, 'payer_name', v_payer_name);
  v_cached := private.claim_command(v_actor_id, 'add_tab_payment', p_request_id, v_payload);
  if v_cached is not null then return v_cached; end if;

  select tab.* into v_tab from public.tabs as tab where tab.id = p_tab_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'validation'; end if;
  if v_tab.status <> 'open' then raise exception using errcode = 'P0001', message = 'tab_closed'; end if;

  v_total := private.current_tab_total(p_tab_id);
  select coalesce(sum(payment.amount), 0) into v_paid
  from public.tab_payments as payment where payment.tab_id = p_tab_id;
  if p_amount > v_total - v_paid then
    raise exception using errcode = 'P0001', message = 'balance_exceeded';
  end if;

  insert into public.tab_payments (tab_id, amount, payer_name, request_id, actor_id)
  values (p_tab_id, p_amount, v_payer_name, p_request_id, v_actor_id)
  returning * into v_payment;
  update public.tabs set updated_at = statement_timestamp() where id = p_tab_id returning * into v_tab;

  v_paid := v_paid + p_amount;
  v_response := jsonb_build_object('ok', true, 'tab', to_jsonb(v_tab), 'payment', to_jsonb(v_payment), 'paid_total', v_paid, 'balance', v_total - v_paid);
  perform private.complete_command(v_actor_id, 'add_tab_payment', p_request_id, v_response);
  return v_response;
end;
$$;

create or replace function public.add_tab_payment(
  p_tab_id uuid,
  p_amount numeric,
  p_payer_name text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.add_tab_payment(p_tab_id, p_amount, p_payer_name, p_request_id);
exception when others then
  if sqlerrm = any (array['validation', 'unauthenticated', 'forbidden', 'tab_closed', 'balance_exceeded', 'idempotency_conflict', 'unknown']::text[]) then raise; end if;
  raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.close_tab(p_tab_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.close_tab(p_tab_id, p_request_id);
exception when others then
  if sqlerrm = any (array['validation', 'unauthenticated', 'forbidden', 'out_of_stock', 'tab_closed', 'duplicate_open_table', 'idempotency_conflict', 'balance_due', 'unknown']::text[]) then raise; end if;
  raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.set_tab_item_quantity(p_item_id uuid, p_new_quantity integer, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.set_tab_item_quantity(p_item_id, p_new_quantity, p_request_id);
exception when others then
  if sqlerrm = any (array['validation', 'unauthenticated', 'forbidden', 'out_of_stock', 'tab_closed', 'balance_exceeded', 'duplicate_open_table', 'idempotency_conflict', 'unknown']::text[]) then raise; end if;
  raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function public.void_tab_item(p_item_id uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.void_tab_item(p_item_id, p_request_id);
exception when others then
  if sqlerrm = any (array['validation', 'unauthenticated', 'forbidden', 'out_of_stock', 'tab_closed', 'balance_exceeded', 'duplicate_open_table', 'idempotency_conflict', 'unknown']::text[]) then raise; end if;
  raise exception using errcode = 'P0001', message = 'unknown';
end;
$$;

create or replace function private.guard_payment_balance_on_item_reduction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_paid numeric;
begin
  if new.quantity >= old.quantity and (old.voided_at is not null or new.voided_at is null) then return new; end if;
  select coalesce(sum(item.line_total), 0) into v_total
  from public.tab_items as item
  where item.tab_id = new.tab_id and item.id <> new.id and item.voided_at is null;
  if new.voided_at is null then v_total := v_total + round(new.unit_price_snapshot * new.quantity, 2); end if;
  select coalesce(sum(payment.amount), 0) into v_paid from public.tab_payments as payment where payment.tab_id = new.tab_id;
  if v_total < v_paid then raise exception using errcode = 'P0001', message = 'balance_exceeded'; end if;
  return new;
end;
$$;

create trigger tab_items_payment_balance_guard
before update of quantity, voided_at on public.tab_items
for each row execute function private.guard_payment_balance_on_item_reduction();

create or replace function private.guard_payment_balance_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_paid numeric;
begin
  if old.status = 'open' and new.status = 'closed' then
    v_total := private.current_tab_total(old.id);
    select coalesce(sum(payment.amount), 0) into v_paid from public.tab_payments as payment where payment.tab_id = old.id;
    if v_paid < v_total then raise exception using errcode = 'P0001', message = 'balance_due'; end if;
  end if;
  return new;
end;
$$;

create trigger tabs_payment_balance_guard
before update of status on public.tabs
for each row execute function private.guard_payment_balance_on_close();

grant select on table public.tab_payments to authenticated;
grant execute on function private.add_tab_payment(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.add_tab_payment(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.close_tab(uuid, uuid) to authenticated;

commit;
