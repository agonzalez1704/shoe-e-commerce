-- Widening orders UPDATE to pedidos_gestionar (so Almacén/Atención can move a
-- pedido along) also handed those roles the commission columns, because RLS is
-- row-level, not column-level. The confirm was already protected; this extends
-- the same trigger to the "marked" side, so touching the payout at all needs
-- the commission permission.
create or replace function public.guard_commission_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then          -- service role (webhooks, backfills)
    return new;
  end if;

  -- only the developer confirms they were paid
  if new.dev_commission_paid_at is distinct from old.dev_commission_paid_at
     and not is_dev() then
    raise exception 'solo el desarrollador puede confirmar el pago de su comisión';
  end if;

  -- and only someone who can see commissions may mark one as paid
  if (new.dev_commission_marked_at is distinct from old.dev_commission_marked_at
      or new.dev_commission_marked_by is distinct from old.dev_commission_marked_by)
     and not (is_admin() or has_permiso('comisiones_ver')) then
    raise exception 'no tienes permiso para registrar pagos de comisión';
  end if;

  return new;
end;
$$;
