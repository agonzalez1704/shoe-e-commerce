-- Resultado del último envío por dispositivo: los errores de push solo iban a
-- los logs de Vercel (30 min de retención) y nadie sabía por qué no llegaban.
alter table public.push_subscriptions add column if not exists last_error text;
