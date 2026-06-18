-- ============================================================
-- Default new variants to MX sizing, and convert existing US seed rows.
-- MX ≈ US + 18 for adult sizing (US 7 -> MX 25 … US 11 -> MX 29).
-- ============================================================
alter table variants alter column size_system set default 'MX';

update variants
set size_system = 'MX',
    size_value  = (size_value::numeric + 18)::text
where size_system = 'US';
