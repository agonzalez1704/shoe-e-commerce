-- PayPal como metodo de pago (Orders v2: el comprador aprueba en PayPal y
-- capturamos al volver). commit_order y create_order ya reciben el enum.
alter type payment_method add value if not exists 'paypal';
