-- Cupon de agradecimiento por reseñar: uno por pedido (aunque reseñe varios
-- productos). Guardarlo en el pedido evita emitir dos y permite mostrarlo de nuevo.
alter table orders add column if not exists cupon_resena text;
