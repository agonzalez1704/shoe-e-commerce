-- Recompensa por reseña + foto: 10% de descuento o una cartera de regalo en la
-- siguiente compra. La cartera viaja como un código de $0 (CARTERA-XXXXXX) que,
-- al usarse en el checkout, marca el pedido para empacarla con los zapatos.
alter table discount_codes
  add column if not exists regalo text check (regalo in ('cartera'));

alter table orders
  add column if not exists regalo text check (regalo in ('cartera')),                         -- este pedido lleva cartera de regalo
  add column if not exists recompensa_resena text check (recompensa_resena in ('descuento', 'cartera')); -- lo que eligió por su reseña
