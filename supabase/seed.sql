-- ============================================================
-- Seed data. Runs automatically on `supabase db reset`.
-- MXN centavos. Active catalog so the storefront renders immediately.
-- Variants generated as size × color; inventory deterministic via hashtext.
-- ============================================================

-- ---------- brands ----------
insert into brands (name, slug) values
  ('Strider', 'strider'),
  ('Vanta',   'vanta'),
  ('Lumen',   'lumen')
on conflict (slug) do nothing;

-- ---------- categories (with SEO copy) ----------
insert into categories (name, slug, description) values
  ('Running', 'running', 'Tenis de running de piel hechos sobre pedido en México. Ligeros, con amortiguación y soporte para tus entrenamientos y carreras diarias. Todas las tallas y anchos, envío a todo el país en 3 a 5 días hábiles.'),
  ('Casual',  'casual',  'Calzado casual de piel para el día a día. Sneakers cómodos que combinan con todo, fabricados a mano sobre pedido. Tallas mexicanas y envío a todo México.'),
  ('Trail',   'trail',   'Calzado trail de piel para terreno difícil. Tracción y resistencia para senderos y exteriores, hechos a mano sobre pedido. Envío a todo el país.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

-- ---------- products ----------
insert into products (brand_id, name, slug, description, gender, base_price_cents, status)
select b.id, p.name, p.slug, p.descr, p.gender, p.price, 'active'
from (values
  ('strider', 'Strider Trail GTX',  'strider-trail-gtx',  'Tenis trail impermeable de piel con suela de alto agarre para senderos y terreno mojado. Hecho a mano sobre pedido en México; elige tu talla y ancho. Envío a todo el país en 3 a 5 días hábiles.', 'unisex', 249900),
  ('strider', 'Strider Road 2',     'strider-road-2',     'Tenis de running ligero de piel para tus carreras y uso diario. Amortiguación cómoda y fabricación a mano sobre pedido. Todas las tallas mexicanas, envío a todo México.',                          'mens',   189900),
  ('vanta',   'Vanta Court Low',    'vanta-court-low',     'Sneaker bajo de piel de líneas limpias, ideal para el uso diario y combinar con cualquier outfit. Hecho sobre pedido con piel seleccionada. Tallas y anchos a elegir.',                              'womens', 159900),
  ('vanta',   'Vanta Slip-On',      'vanta-slip-on',       'Calzado slip-on de piel, fácil de poner y cómodo todo el día. Diseño minimalista hecho a mano sobre pedido en México. Envío a todo el país.',                                                        'unisex', 119900),
  ('lumen',   'Lumen Air Max',      'lumen-air-max',       'Tenis de running de piel con amortiguación visible para máxima comodidad en cada kilómetro. Fabricado sobre pedido; todas las tallas y anchos disponibles.',                                          'mens',   299900),
  ('lumen',   'Lumen Studio',       'lumen-studio',        'Tenis flexible de piel para entrenamiento y estudio. Ligero y cómodo, hecho a mano sobre pedido. Tallas mexicanas, envío a todo México.',                                                            'womens', 174900)
) as p(brand_slug, name, slug, descr, gender, price)
join brands b on b.slug = p.brand_slug
on conflict (slug) do update set description = excluded.description;

-- ---------- product images (3 per product, placeholder service) ----------
insert into product_images (product_id, url, alt, position)
select pr.id,
       'https://picsum.photos/seed/' || pr.slug || '-' || g || '/600/600',
       pr.name,
       g
from products pr
cross join generate_series(0, 2) as g
where not exists (select 1 from product_images x where x.product_id = pr.id);  -- idempotent

-- ---------- product ↔ category ----------
insert into product_categories (product_id, category_id)
select pr.id, c.id
from products pr
join categories c on c.slug = case
  when pr.slug like '%trail%' then 'trail'
  when pr.slug like '%road%' or pr.slug like '%air%' or pr.slug like '%studio%' then 'running'
  else 'casual'
end
on conflict (product_id, category_id) do nothing;

-- ---------- variants: size (MX 25–29) × color (black, white) ----------
insert into variants (product_id, sku, size_value, size_system, width, color, status)
select pr.id,
       pr.slug || '-' || s.size || '-' || c.color,   -- unique sku
       s.size, 'MX', 'medium', c.color, 'active'
from products pr
cross join (values ('25'), ('26'), ('27'), ('28'), ('29')) as s(size)
cross join (values ('black'), ('white')) as c(color)
on conflict (sku) do nothing;

-- ---------- inventory: deterministic 5–20 units per variant ----------
insert into inventory (variant_id, qty_on_hand, qty_reserved, reorder_level)
select v.id, 5 + (abs(hashtext(v.sku)) % 16), 0, 3
from variants v
on conflict (variant_id) do nothing;

-- force a few out-of-stock (only visible if a product is switched off made-to-order)
update inventory set qty_on_hand = 0
where variant_id in (
  select id from variants where color = 'white' and size_value = '25'
);

-- ---------- discount code ----------
insert into discount_codes (code, type, value, min_subtotal_cents, active)
values ('BIENVENIDO10', 'percent', 10, 0, true)
on conflict (code) do nothing;
