-- Only the developer can confirm they were paid. The server action already checks
-- this, but both people here are admins with write access to orders, so without a
-- DB guard the rule would be a UI convention rather than an actual guarantee.
create or replace function public.guard_commission_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.dev_commission_paid_at is distinct from old.dev_commission_paid_at
     and auth.uid() is not null            -- service role (webhooks/backfills) passes
     and not is_dev() then
    raise exception 'solo el desarrollador puede confirmar el pago de su comisión';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_commission_confirm on orders;
create trigger orders_guard_commission_confirm
  before update on orders
  for each row execute function public.guard_commission_confirm();
