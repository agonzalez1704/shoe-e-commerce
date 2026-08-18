-- Descuento de bienvenida por crear cuenta.
--
-- 77 de cada 100 pedidos se hacen como invitado (40 de 52), así que del
-- comprador no queda más que un correo suelto en `orders`: no hay a quién
-- volverle a escribir ni a quién construirle una audiencia. El 10% es el pago
-- por ese dato.
--
-- El código es POR CLIENTE y de un solo uso. Uno fijo tipo "BIENVENIDO10" se
-- comparte en cinco minutos y acaba descontándole a quien nunca se registró,
-- que es justo lo contrario de lo que se busca.

alter table discount_codes
  add column if not exists customer_id uuid references customers (id) on delete cascade;

-- Un cliente, un código de bienvenida.
create unique index if not exists discount_codes_customer_uniq
  on discount_codes (customer_id) where customer_id is not null;

-- Sufijo corto y legible por teléfono: sin 0/O ni 1/I, que es donde la gente
-- se equivoca al dictarlo.
create or replace function public.codigo_bienvenida()
returns text language sql volatile as $$
  select 'HOLA' || string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 32 + 1)::int, 1), ''
  ) from generate_series(1, 5);
$$;

-- El código nace con la cuenta: si se generara al comprar, llegaría tarde.
create or replace function public.cliente_nuevo_bienvenida()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  -- El sufijo es aleatorio, así que un choque es posible aunque raro.
  for i in 1..5 loop
    v_code := codigo_bienvenida();
    begin
      insert into discount_codes (code, type, value, max_uses, expires_at, active, customer_id)
      values (v_code, 'percent', 10, 1, now() + interval '30 days', true, new.id);
      return new;
    exception when unique_violation then
      -- choque de código o el cliente ya tiene el suyo: en el segundo caso no
      -- hay nada que hacer, y el índice por customer_id lo distingue
      if exists (select 1 from discount_codes where customer_id = new.id) then return new; end if;
    end;
  end loop;
  return new; -- sin código antes que sin cuenta: nunca bloquear el registro
end;
$$;

drop trigger if exists cliente_nuevo_bienvenida on customers;
create trigger cliente_nuevo_bienvenida
  after insert on customers
  for each row execute function public.cliente_nuevo_bienvenida();

-- El cliente ve el suyo; los códigos de campaña (customer_id null) siguen
-- siendo invisibles para todos.
drop policy if exists cliente_lee_su_codigo on discount_codes;
create policy cliente_lee_su_codigo on discount_codes
  for select using (customer_id = auth.uid());

-- Los 14 clientes que ya existen también lo reciben.
insert into discount_codes (code, type, value, max_uses, expires_at, active, customer_id)
select codigo_bienvenida(), 'percent', 10, 1, now() + interval '30 days', true, c.id
from customers c
where not exists (select 1 from discount_codes d where d.customer_id = c.id)
on conflict do nothing;
