-- Seguimiento proactivo del pedido. La fabricacion toma ~7 dias entre el pago
-- y el envio y en ese tramo el cliente no recibia nada; este sello marca el
-- correo de "tu par va en fabricacion" para mandarlo una sola vez.
alter table orders add column if not exists production_update_sent_at timestamptz;
