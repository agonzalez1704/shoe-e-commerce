# Graph Report - .  (2026-07-18)

## Corpus Check
- 179 files · ~223,830 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 623 nodes · 1218 edges · 31 communities (23 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.74)
- Token cost: 60,000 input · 9,746 output

## Community Hubs (Navigation)
- Auto-toon Angle Gen
- WhatsApp Sales Agent & Analytics
- Admin Fulfillment & Orders
- Auth & App Shell
- Catalog & SEO
- Payments, Email & CFDI
- Deploy & Ops Docs
- Build Config
- Dependencies
- TypeScript Config
- Cart & Combo Pricing
- Layout & Brand Theme
- Checkout Form & Payment UI
- Admin Product Editor
- Landing Page
- Legal Pages
- Order Tracking
- Product Detail Page
- Skydropx Shipping
- Order Confirmation
- Combo Builder & Colors
- Seed Script ShoesArt
- Variant Picker
- Seed Images Script
- Middleware
- MCP Server
- Next Config
- PostCSS Config
- Kapso Register Script
- Serena Config
- Vercel Config

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 41 edges
2. `createClient()` - 41 edges
3. `formatCents()` - 29 edges
4. `requireAdmin()` - 21 edges
5. `compilerOptions` - 16 edges
6. `scripts` - 14 edges
7. `SITE_URL` - 13 edges
8. `POST()` - 10 edges
9. `checkout()` - 10 edges
10. `comboOf()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Aplazo (pago a meses)` --semantically_similar_to--> `Conekta Payments`  [INFERRED] [semantically similar]
  public/llms.txt → DEPLOY.md
- `AdminInventory()` --calls--> `createClient()`  [EXTRACTED]
  app/admin/inventory/page.tsx → lib/supabase/server.ts
- `EditProduct()` --calls--> `createClient()`  [EXTRACTED]
  app/admin/products/[id]/edit/page.tsx → lib/supabase/server.ts
- `updateOrderStatus()` --calls--> `sendShippedEmail()`  [EXTRACTED]
  app/admin/actions.ts → lib/email.ts
- `setFulfillmentStage()` --calls--> `sendShippedEmail()`  [EXTRACTED]
  app/admin/actions.ts → lib/email.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Conekta Payment Confirmation Flow** — deploy_conekta_webhook, deploy_conekta_order_paid, docs_emails_send_paid_email [INFERRED 0.75]
- **Per-brand Deployment Stack** — deploy_brand_config, deploy_supabase_project, deploy_vercel_project, public_llms_blade_brand [INFERRED 0.75]
- **HTTP Cron Email Jobs** — deploy_cron_review_requests, deploy_cron_payment_reminders, docs_emails_send_review_email, docs_emails_send_payment_reminder_email [INFERRED 0.75]

## Communities (31 total, 8 thin omitted)

### Community 0 - "Auto-toon Angle Gen"
Cohesion: 0.07
Nodes (43): dismissAngleJob(), reconcileJob(), refineImageLogo(), startAngleJob(), Payload, POST(), GlobalJobProgress(), ImageUploader() (+35 more)

### Community 1 - "WhatsApp Sales Agent & Analytics"
Cohesion: 0.08
Nodes (41): GET(), authorized(), guarded(), handler, PERIODO, extraerTexto(), Msg, POST() (+33 more)

### Community 2 - "Admin Fulfillment & Orders"
Cohesion: 0.08
Nodes (36): CARRIER_MAP, FulfillmentStage, generateSkydropxLabel(), OrderStatus, saveTracking(), setFulfillmentStage(), setInventory(), setProductStatus() (+28 more)

### Community 3 - "Auth & App Shell"
Cohesion: 0.10
Nodes (31): AdminLayout(), AdminOrders(), mxn(), shortDate(), Status, STATUSES, AdminHome(), mxn() (+23 more)

### Community 4 - "Catalog & SEO"
Cohesion: 0.09
Nodes (28): CategoryPage(), generateMetadata(), metadata, ProductsPage(), SearchParams, generateMetadata(), ProductPage(), activeProducts() (+20 more)

### Community 5 - "Payments, Email & CFDI"
Cohesion: 0.11
Nodes (29): GET(), GET(), POST(), lineFiscal(), stampOrderCfdi(), StampResult, authHeader(), conekta() (+21 more)

### Community 6 - "Deploy & Ops Docs"
Cohesion: 0.07
Nodes (35): lib/brand.ts Brand Config, lib/cfdi.ts Field Mapping, Conekta Payments, order.paid Event, Conekta Webhook Handler, /api/cron/payment-reminders, /api/cron/review-requests, expire_pending_orders Job (+27 more)

### Community 7 - "Build Config"
Cohesion: 0.06
Nodes (31): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, name (+23 more)

### Community 8 - "Dependencies"
Cohesion: 0.07
Nodes (29): clsx, mcp-handler, @modelcontextprotocol/sdk, next, dependencies, clsx, mcp-handler, @modelcontextprotocol/sdk (+21 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, ES2022, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 10 - "Cart & Combo Pricing"
Cohesion: 0.17
Nodes (18): availableQty(), CartSummary, ComboNudge, COOKIE_OPTS, getCart(), removeFromCart(), resolveCart(), Resolved (+10 more)

### Community 11 - "Layout & Brand Theme"
Cohesion: 0.12
Nodes (17): jetbrains, metadata, orgJsonLd, outfit, RootLayout(), siteJsonLd, Logo(), ProductImage() (+9 more)

### Community 12 - "Checkout Form & Payment UI"
Cohesion: 0.12
Nodes (12): CartLine, CheckoutInput, CheckoutResult, CheckoutForm(), Confirmation(), Method, METHODS, mxn() (+4 more)

### Community 13 - "Admin Product Editor"
Cohesion: 0.18
Nodes (15): deleteProduct(), ProductImageInput, ProductInput, saveProduct(), slugify(), VariantInput, writeImages(), writeVariants() (+7 more)

### Community 14 - "Landing Page"
Cohesion: 0.16
Nodes (10): ComboBand(), Feature, FEATURES, Home(), mxn(), mxn(), ProductCardItem(), ProductCard (+2 more)

### Community 15 - "Legal Pages"
Cohesion: 0.15
Nodes (8): metadata, NOTE: los plazos y coberturas deben coincidir EXACTO con lo que ofreces en, metadata, metadata, NOTE: plantilla base conforme a la Ley Federal de Protección de Datos, metadata, NOTE: plantilla base. Reemplaza los [CAMPOS] con los datos reales y valida, LegalPage()

### Community 16 - "Order Tracking"
Cohesion: 0.26
Nodes (8): AdminProducts(), mxn(), TrackedOrder, metadata, mxn(), STEPS, TrackOrder(), formatCents()

### Community 17 - "Product Detail Page"
Cohesion: 0.21
Nodes (8): Img, Lightbox(), PdpInfo(), SIZE_ROWS, mxn(), ProductDetail(), VALUE_PROPS, ZoomImage()

### Community 18 - "Skydropx Shipping"
Cohesion: 0.27
Nodes (11): Address, addrPayload(), api(), createShipment(), generateLabel(), ORIGIN, PARCEL, quote() (+3 more)

### Community 19 - "Order Confirmation"
Cohesion: 0.25
Nodes (4): OrderConfirmation(), PackageTrackerCard(), PackageTrackerCardProps, cn()

### Community 20 - "Combo Builder & Colors"
Cohesion: 0.33
Nodes (7): ComboBuilder(), mxn(), Slot, ProductDetail, colorHex(), MAP, swatchBg()

### Community 21 - "Seed Script ShoesArt"
Cohesion: 0.29
Nodes (4): auth, brandId, materiales, PRODUCTS

### Community 22 - "Variant Picker"
Cohesion: 0.60
Nodes (4): addToCart(), mxn(), Variant, VariantPicker()

## Knowledge Gaps
- **170 isolated node(s):** `supabase`, `OrderStatus`, `FulfillmentStage`, `CARRIER_MAP`, `Status` (+165 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Auth & App Shell` to `Admin Fulfillment & Orders`, `Catalog & SEO`, `Cart & Combo Pricing`, `Admin Product Editor`, `Order Tracking`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `createAdminClient()` connect `WhatsApp Sales Agent & Analytics` to `Auto-toon Angle Gen`, `Cart & Combo Pricing`, `Auth & App Shell`, `Payments, Email & CFDI`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `requireAdmin()` connect `Admin Fulfillment & Orders` to `Auto-toon Angle Gen`, `Auth & App Shell`, `Admin Product Editor`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `supabase`, `OrderStatus`, `FulfillmentStage` to the rest of the system?**
  _170 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auto-toon Angle Gen` be split into smaller, more focused modules?**
  _Cohesion score 0.06662770309760374 - nodes in this community are weakly interconnected._
- **Should `WhatsApp Sales Agent & Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.08181818181818182 - nodes in this community are weakly interconnected._
- **Should `Admin Fulfillment & Orders` be split into smaller, more focused modules?**
  _Cohesion score 0.07591836734693877 - nodes in this community are weakly interconnected._