-- MercadoPago Checkout Pro (redirect flow, parallel provider — does NOT go
-- through Conekta). Adds the payment_method value used by create_order/commit_order.
-- Own migration: a new enum value can't be used in the same tx it's added.
alter type payment_method add value if not exists 'mercadopago';
