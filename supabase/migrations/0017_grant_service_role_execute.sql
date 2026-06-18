-- ============================================================
-- FIX: the service-role-only RPCs were revoked from PUBLIC (0006/0012), which
-- also stripped the EXECUTE that `service_role` inherited via PUBLIC. The admin
-- client (service role) then got "permission denied for function ...", silently
-- breaking record_payment / set_order_amounts / commit_order (webhook) / rate limiting.
-- Grant EXECUTE explicitly to service_role.
-- ============================================================

grant execute on function public.check_rate_limit(text, text, int, int) to service_role;
grant execute on function public.set_order_amounts(uuid, bigint) to service_role;
grant execute on function public.record_payment(uuid, text, payment_method, bigint, text, text, text, timestamptz) to service_role;
grant execute on function public.commit_order(uuid, text, bigint, payment_method) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.expire_pending_orders() to service_role;

-- future service-role RPCs stay callable without another grants migration
alter default privileges in schema public grant execute on functions to service_role;
