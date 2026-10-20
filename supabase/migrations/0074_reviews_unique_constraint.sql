-- El índice único era parcial (where order_id is not null) y PostgREST no lo
-- puede usar como ON CONFLICT: el upsert de /resena fallaba siempre con
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", así que ninguna reseña por enlace se guardó jamás.
-- Una restricción única normal hace lo mismo — los NULL son distintos, así que
-- las reseñas sin pedido (importadas) siguen permitidas — y sí sirve al upsert.
drop index if exists reviews_order_product_uniq;
alter table reviews add constraint reviews_order_product_key unique (order_id, product_id);
