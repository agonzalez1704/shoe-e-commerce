-- Suela de fábrica de cada modelo (dato interno del taller, no sale en la
-- tienda): la ficha de producción la imprime en su casilla SUELA, que antes
-- iba en blanco para llenarse a mano. Valores dados por el dueño (2026-11-17);
-- los demás modelos se capturan desde el admin.
alter table public.products add column if not exists suela text;

update public.products set suela = 'Chichen' where lower(name) in ('norwich', 'thunder') and suela is null;
update public.products set suela = 'Impacto' where lower(name) = 'bolton' and suela is null;
