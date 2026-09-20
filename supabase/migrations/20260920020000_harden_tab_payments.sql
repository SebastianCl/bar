begin;

revoke all on function public.add_tab_payment(uuid, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.add_tab_payment(uuid, numeric, text, uuid)
  to authenticated;

create index if not exists tab_payments_actor_id_idx
  on public.tab_payments (actor_id);

commit;
