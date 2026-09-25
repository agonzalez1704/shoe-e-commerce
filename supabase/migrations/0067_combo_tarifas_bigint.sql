-- 0066 declaro combo_descuento_pool / combo_precio_par con int, pero
-- products.combo_price_cents es bigint y Postgres no lo baja a int solo:
-- create_order fallaba con "function ... does not exist" en TODO carrito con
-- pares del combo. Se redefinen con bigint (int sube a bigint implicito).

drop function if exists combo_descuento_pool(bigint[], boolean[], int, int, int, int);
drop function if exists combo_precio_par(int, int, int, int);

create or replace function combo_precio_par(p_base bigint, p_mixto bigint, p_exotico bigint, p_n_exoticos int)
returns bigint language sql immutable as $$
  select case p_n_exoticos
    when 0 then p_base
    when 1 then coalesce(p_mixto, p_base)
    else coalesce(p_exotico, p_base)
  end;
$$;

create or replace function combo_descuento_pool(
  p_precios bigint[], p_exoticos boolean[], p_min int, p_base bigint, p_mixto bigint, p_exotico bigint
) returns bigint language plpgsql immutable as $$
declare
  ex bigint[] := '{}'; cl bigint[] := '{}'; todos bigint[];
  n int; pares int; suma bigint := 0; descuento bigint := 0;
begin
  if p_precios is null or p_base is null then return 0; end if;
  n := coalesce(array_length(p_precios, 1), 0);

  if p_min <> 2 then
    select array_agg(x order by x desc) into todos from unnest(p_precios) x;
    pares := n / p_min;
    if pares = 0 then return 0; end if;
    select sum(x) into suma from unnest(todos[1:pares * p_min]) x;
    return greatest(0, suma - pares * p_base);
  end if;

  select coalesce(array_agg(x order by x desc), '{}') into ex
    from unnest(p_precios, p_exoticos) as u(x, e) where e;
  select coalesce(array_agg(x order by x desc), '{}') into cl
    from unnest(p_precios, p_exoticos) as u(x, e) where not e;

  while coalesce(array_length(ex, 1), 0) >= 2 loop
    descuento := descuento + greatest(0, ex[1] + ex[2] - combo_precio_par(p_base, p_mixto, p_exotico, 2));
    ex := ex[3:];
  end loop;
  while coalesce(array_length(cl, 1), 0) >= 2 loop
    descuento := descuento + greatest(0, cl[1] + cl[2] - combo_precio_par(p_base, p_mixto, p_exotico, 0));
    cl := cl[3:];
  end loop;
  if coalesce(array_length(ex, 1), 0) = 1 and coalesce(array_length(cl, 1), 0) = 1 then
    descuento := descuento + greatest(0, ex[1] + cl[1] - combo_precio_par(p_base, p_mixto, p_exotico, 1));
  end if;
  return descuento;
end $$;

grant execute on function combo_precio_par(bigint, bigint, bigint, int) to anon, authenticated;
grant execute on function combo_descuento_pool(bigint[], boolean[], int, bigint, bigint, bigint) to anon, authenticated;
