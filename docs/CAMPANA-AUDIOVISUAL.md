# Campaña audiovisual — Calzado Blade

> Plan guardado el 14 sep 2026 para retomarse más adelante. Nada de esto está
> en ejecución todavía.

Una campaña de este calibre no es un video bonito: es **un concepto central
desplegado en un sistema de piezas, mapeadas al embudo, con canal y medida para
cada una**.

---

## 1. El concepto (todo cuelga de aquí)

Diferenciador verificable: **calzado de piel hecho a mano en León**.

> **"Hecho a tu paso"** — la mano que corta la piel, el par que sale de una
> bodega real en León, al precio de un tenis de marca extranjera. La promo como
> cierre: *2 pares por $1,999*.

Un solo concepto hace que todas las piezas se reconozcan entre sí. Sin él se
produce "contenido"; con él, campaña.

---

## 2. Inventario de piezas

### Video (el corazón)

| Pieza | Duración | Uso |
|---|---|---|
| Hero de campaña: proceso → producto → calle | 30s | Ads, YouTube, portada del sitio |
| Cortes del hero | 15s y 6s | Reels/Stories ads, bumpers |
| Reels de proceso (corte de piel, costura, grabado) | 15–30s ×4 | Orgánico IG/TikTok — lo que nadie puede copiar |
| Macro de textura + sonido de la piel | 10–15s ×3 | Orgánico, gancho de scroll |
| Unboxing / primer uso | 20s ×2 | Retargeting y orgánico |
| UGC estilo selfie ("me llegaron, así se ven") | 20–30s ×2 | Ads — el formato que más convierte en Meta |

### Gráficos

- 3 carruseles de pauta con los más vendidos (Manchester, Pisa, New Jersey —
  confirmar contra Admin → Métricas → Producto antes de producir)
- Estáticos 4:5 y 9:16 de la promo 2×$1,999, rehechos bajo el estilográfico
- Banners hero del sitio y de temporada
- Plantillas de historia: precio, lanzamiento, reseña de cliente

---

## 3. Canales y por qué

| Canal | Rol | Por qué |
|---|---|---|
| **Meta Ads (FB+IG)** | Conversión — el motor | Ya funciona: ROAS ~3, pixel entrenado, audiencias de retargeting creadas. Los videos nuevos entran aquí primero como creativos. |
| **Instagram orgánico** | Vitrina y confianza | Hoy no existe, y quien ve un anuncio busca el perfil antes de pagar $1,900. Es fuga de conversión, no "branding". |
| **TikTok orgánico** | Alcance gratis | El contenido de taller es justo el formato que TikTok premia. Sin pauta al inicio. |
| **YouTube Shorts** | Gratis, mismo esfuerzo | Se republican los mismos verticales. Costo marginal cero. |
| **WhatsApp** (estados + post-venta) | Retención | Ya se vende ahí; estados con lanzamientos para quien ya compró. |
| **Email** (Resend, ya montado) | Retención | Envío mensual con video de proceso y modelo nuevo. |
| **Sitio** | Cierre | Video hero en portada y fotos de campaña en las PDP. |

**Todavía no:** TikTok Ads (hasta que el orgánico valide qué creativos
funcionan) ni Google Ads (el volumen de búsqueda de marca es chico; Meta rinde
más por peso).

---

## 4. Quién produce qué

### Producible con las herramientas del proyecto (Claude)

- **Estilográfico**: luz, paleta, encuadres, tipografías, qué sí / qué no
- **Imágenes de campaña con IA** a partir de las fotos de producto (lifestyle,
  locaciones, escenas editoriales)
- **Videos UGC con IA** (portavoz sosteniendo el producto) y **motion graphics**
  (promos animadas, títulos, cortes con subtítulos)
- Carruseles, banners, plantillas y calendario editorial con copies

### Requiere cámara real (teléfono o una jornada contratada)

- **El taller**: manos cortando piel, costura, hormas. Es la pieza más valiosa
  y la IA no puede fingirla sin que se note — fingirla quemaría la marca.
- Unboxing con la caja real.

Referencia de costo: en vez de un plan mensual de agencia (la propuesta de
Flowbit empezaba en $15,000/mes + $10,000 de diagnóstico), comprar **una
jornada suelta de taller y producto** (~$6,000–8,000). El resto se produce
internamente.

---

## 5. Cadencia y presupuesto

- **Orgánico**: 4–5 piezas por semana (2 de proceso, 1 de producto, 1 UGC o
  reseña, 1 de promo), rotando las mismas entre IG, TikTok y Shorts.
- **Pauta**: mantener el presupuesto diario actual; al validar los videos
  nuevos, subir a ~$400/día concentrando en los 2 mejores creativos. Encender
  la campaña de retargeting (~$70/día) cuando el perfil orgánico exista.
- **Medida**: ROAS por creativo (se consulta por API), clics perfil → sitio y
  ventas atribuidas por pixel. Seguidores es métrica de vanidad.

---

## 6. Primeras 2 semanas

1. **Dueño**: crear @calzadoblade en Instagram y TikTok, y pasar los handles
   para agregarlos al footer del sitio (`brand.social` en `lib/brand.ts`).
2. **Claude**: estilográfico + calendario editorial del mes con copies.
3. **Claude**: primer paquete — 4 imágenes de campaña IA, 1 video UGC IA y
   2 estáticos de promo renovados.
4. **Dueño**: 20 minutos de teléfono en la bodega grabando proceso, siguiendo
   una lista de tomas plano por plano que Claude entrega antes.
5. **Claude**: edición de reels de proceso (subtítulos, música) y alta de los
   creativos en Meta por API.

---

## Estado de dependencias al guardar este plan

- Instagram / TikTok de la marca: **no existen**
- Facebook: enlazado en el footer del sitio
- Audiencias de retargeting en Meta: creadas (checkout 14d, carrito 14d, vista
  de producto 30d, compradores 180d como exclusión)
- Campaña de retargeting: fue eliminada en Ads Manager; hay que rearmarla
- Reel `blade-calzado-instagram.mp4`: activo en la campaña de ventas
