-- Recuperacion de carrito para invitados + segundo recordatorio.
--
-- El 96% de los carritos abandonados son de invitados sin cuenta: su correo
-- solo existia si terminaban el checkout, que es justo lo que no hicieron.
-- contact_email lo captura el formulario del checkout en cuanto lo escriben,
-- antes de pagar, y con eso el cron puede alcanzarlos.
alter table carts add column if not exists contact_email text;
-- Segundo (y ultimo) recordatorio, 48h despues del primero, con codigo.
alter table carts add column if not exists abandoned_email2_sent_at timestamptz;
