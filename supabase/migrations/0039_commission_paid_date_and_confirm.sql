-- Developer commission, round 2:
--   * the weekly cut follows the PAYMENT date, not when the order was created
--   * paying the commission is two-step: any admin can mark it paid, the dev
--     confirms receipt. The dev marking it does both at once.

-- When the money actually landed. A trigger fills it on the transition to paid,
-- so every path (Conekta webhook, MercadoPago webhook, card at checkout) is
-- covered without touching commit_order.
alter table orders add column if not exists paid_at timestamptz;

create or replace function public.set_order_paid_at()
returns trigger language plpgsql as $$
begin
  if new.status in ('paid', 'fulfilled')
     and old.status is distinct from new.status
     and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_paid_at on orders;
create trigger orders_set_paid_at
  before update on orders
  for each row execute function public.set_order_paid_at();

-- best effort for orders paid before this column existed: commit_order was the
-- last thing to touch them
update orders set paid_at = updated_at
where status in ('paid', 'fulfilled') and paid_at is null;

-- two-step payout: marked by whoever paid, confirmed by the dev
alter table orders add column if not exists dev_commission_marked_at timestamptz;
alter table orders add column if not exists dev_commission_marked_by uuid references auth.users (id);

-- who is the developer being paid (only they can confirm receipt)
alter table admin_users add column if not exists is_dev boolean not null default false;

update admin_users set is_dev = true
where user_id in (select id from customers where email = 'agonzalez.nrn02@gmail.com');

create or replace function public.is_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid() and is_dev);
$$;

grant execute on function public.is_dev() to authenticated;
