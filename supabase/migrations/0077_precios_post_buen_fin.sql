-- Precios regulares después del Buen Fin 2026 (pedido del dueño, 2026-11-17).
-- Durante el Buen Fin se subió el precio base de varios modelos; al cerrar las
-- promociones (0:00 del 18 nov, hora de León = 06:00 UTC) vuelven a su precio de
-- antes, salvo Manchester y Londres, que suben de $1,259 a $1,359.
-- Se aplica al precio base y al de cada color que tenga precio propio.
create or replace function public.precios_post_buen_fin_2026()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Manchester', 135900), ('Londres', 135900),
      ('Thunder', 135900), ('Norwich', 135900), ('Bolton', 135900),
      ('Acrópolis', 129900), ('Frosinone', 129900),
      ('Pisa', 139900), ('Manhattan', 139900),
      ('New Jersey', 159900)
    ) as t(nombre, precio)
  loop
    update products set base_price_cents = r.precio where name = r.nombre;
    update variants v set price_cents = r.precio
      from products p
      where v.product_id = p.id and p.name = r.nombre and v.price_cents is not null;
  end loop;
  -- una sola vez: el cron '0 6 18 11 *' se repetiría el próximo año
  perform cron.unschedule('precios-post-buen-fin-2026');
end;
$$;

select cron.schedule(
  'precios-post-buen-fin-2026',
  '0 6 18 11 *',
  $$ select public.precios_post_buen_fin_2026(); $$
);
