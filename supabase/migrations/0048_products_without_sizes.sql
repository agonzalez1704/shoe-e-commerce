-- Products that don't come in sizes.
--
-- The catalog was built for shoes, where a variant is the cell of a
-- size × width × colour matrix. The next store sells electric scooters: every
-- product is a simple one with a single SKU, and colour is baked into the
-- product itself ("G2 Pro Amarillo") rather than chosen at the picker.
--
-- Forcing size_value = 'única' and width = 'medium' on those rows would put a
-- lie in every record and leak into the admin, the picker and the OG cards.
-- The columns become optional instead. Blade is untouched: existing rows keep
-- their values, and dropping NOT NULL is backwards compatible.

alter table variants
  alter column size_value  drop not null,
  alter column size_system drop not null,
  alter column size_system drop default,
  alter column width       drop not null,
  alter column width       drop default;

-- The uniqueness key has to keep holding once those columns are null. Postgres
-- treats NULLs as distinct by default, so (product, null, null, 'Amarillo')
-- could be inserted twice and the catalog would show the same scooter twice.
-- NULLS NOT DISTINCT (PG15+) makes null compare equal here.
alter table variants
  drop constraint variants_product_id_size_value_width_color_key;

alter table variants
  add constraint variants_product_id_size_value_width_color_key
  unique nulls not distinct (product_id, size_value, width, color);

-- Specs as data, not prose.
--
-- Motor, top speed, range, battery and load are what this category is actually
-- compared on, and on the manufacturer's own site they live inside the
-- description — which is why the same page states both "45 km/h · 35 km" and
-- "50 km/h · 50 km". Structured, they can be filtered and compared; free text
-- can only be re-typed and contradicted.
--
-- JSONB rather than columns because the useful keys differ per category: a
-- scooter has autonomy, a helmet has a shell size, a shoe has none of it.
alter table products
  add column if not exists attributes jsonb not null default '{}'::jsonb;

create index if not exists products_attributes_idx on products using gin (attributes);
