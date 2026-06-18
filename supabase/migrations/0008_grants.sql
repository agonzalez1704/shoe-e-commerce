-- ============================================================
-- Role grants for PostgREST (anon / authenticated).
-- RLS is still the row-level gate; these are the table-level privileges
-- the roles need before RLS is even consulted. Without them PostgREST
-- returns 42501 "permission denied for table".
--
-- NOTE: we deliberately do NOT blanket-grant EXECUTE on functions —
-- the service-role-only RPCs (reserve/commit/cancel/etc.) were revoked
-- in 0003/0006 on purpose. User-callable RPCs are granted individually.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- read: both roles may attempt; RLS decides which rows come back
grant select on all tables in schema public to anon, authenticated;

-- write: only logged-in users; RLS scopes to their own rows
grant insert, update, delete on all tables in schema public to authenticated;

-- service_role bypasses RLS but still needs table privileges (guest carts,
-- order reads in the checkout action, webhook writes).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- keep future tables working without another grants migration
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
