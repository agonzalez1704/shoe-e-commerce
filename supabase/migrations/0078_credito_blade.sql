-- Crédito Blade (docs/CREDITO-BLADE.md): cada pedido pagado regala un código de
-- $150 para la siguiente compra, con vencimiento. Solo agrega columnas.
alter table public.orders
  add column if not exists credito_codigo text,
  add column if not exists credito_recordado_at timestamptz; -- aviso de vencimiento ya mandado
