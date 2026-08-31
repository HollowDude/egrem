/**
 * Carrito de Drupal Commerce — camino real reescrito para el carrito multitienda
 * (un pedido por tienda, agrupados bajo un `cart_group`).
 *
 * Contratos (confirmados con el backend, ver plan de filtro geográfico):
 *  - POST /{lang}/api/cart/add
 *      body: { sku, store_id, quantity, cart_group? }
 *      respuesta: { cart_group, orders: [{ store_id, store_label, order_id, items, total }] }
 *  - GET  /{lang}/api/cart?cart_group=<uuid>
 *  - POST /{lang}/api/cart/checkout  body: { cart_group }
 *  Auth: `Authorization: Bearer <accessToken>` + `X-Auth-Token: <NODEHIVE_API_KEY>`
 *  (igual que el resto del ecosistema NodeHive).
 *
 * ⚠️ Gap de contrato (plan §1.4): `items[]` NO trae un id de línea estable.
 * Por eso `updateCartItem`/`removeCartItem` por línea están deshabilitados en el
 * UI real hasta que el backend agregue `item_id`. El stopgap es `removeCartStore`
 * (vaciar el pedido completo de una tienda vía `order_id`, que SÍ viene).
 *
 * Siempre en modo real (flag CART_REAL eliminado).
 */
import { getBaseUrlValue, getApiKeyValue } from '@/lib/nodehive/client';
import { fetchProductosMerchDetalle } from '@/lib/nodehive/comercio';
import type { ProductoVariacion } from '@/types/producto';

export interface CartLineItem {
  itemId?: string; // ausente hasta que el backend agregue `item_id` (plan §1.4)
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  imagen?: string | null;
  talla?: string | null;
  color?: string | null;
  edicion?: string | null;
  formato?: string | null;
  /**
   * Stock disponible de esta línea en su tienda, enriquecido desde el catálogo
   * (misma fuente que la ficha de detalle → misma "ley" de stock). `null` =
   * ilimitado o sin datos; en ese caso el backend sigue validando al añadir.
   */
  stock?: number | null;
  // Solo disponibles en modo mock (el endpoint real no los devuelve aún):
  variationUuid?: string | null;
  storeId?: string | null;
}

export type CartLine = CartLineItem; // alias de retrocompatibilidad

export interface CartGroupOrder {
  storeId: string;
  storeLabel: string;
  orderId: number;
  items: CartLineItem[];
  total: number;
}

export interface Cart {
  cartGroup: string | null;
  orders: CartGroupOrder[];
  subtotal: number;
  count: number;
}

export interface AddToCartInput {
  variationId?: number;
  variationUuid?: string;
  bundle: string;
  quantity: number;
  talla?: string;
  color?: string;
  edicion?: string;
  formato?: string;
  sku?: string;
  title?: string;
  precioUnitario?: number;
  imagen?: string;
  storeId?: string;
}

export interface CartAuth {
  accessToken: string;
  csrfToken?: string;
  /** Cookie de sesión de Drupal (del login) — necesaria para autenticar escrituras
   *  JSON:API como el usuario; el Bearer solo no basta para DELETE/PATCH. */
  sessionCookie?: string;
  lang?: 'es' | 'en';
  uid?: string | number;
}

/** Extrae `name=value` de un `Set-Cookie` crudo (descarta atributos). */
function sessionCookieHeader(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

const USAR_REAL = true;

/** Cookie httpOnly que identifica el grupo de pedidos del usuario (una por checkout). */
export const CART_GROUP_COOKIE = 'egrem_cart_group';
export const CART_GROUP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // ~30 días

// ─── Helpers de agregación ────────────────────────────────────────────────────
function calcularTotales(orders: CartGroupOrder[]): { subtotal: number; count: number } {
  let subtotal = 0;
  let count = 0;
  for (const o of orders) {
    subtotal += o.total;
    count += o.items.reduce((a, i) => a + i.quantity, 0);
  }
  return { subtotal, count };
}

function normalizar(orders: CartGroupOrder[], cartGroup: string | null = null): Cart {
  const { subtotal, count } = calcularTotales(orders);
  return { cartGroup, orders, subtotal, count };
}

function linesToOrders(lines: CartLineItem[]): CartGroupOrder[] {
  const porTienda = new Map<string, CartLineItem[]>();
  for (const l of lines) {
    const id = l.storeId ?? 'default';
    if (!porTienda.has(id)) porTienda.set(id, []);
    porTienda.get(id)!.push(l);
  }
  const labels: Record<string, string> = { '2': 'Egrem', '3': 'Tienda prueba', default: 'Tienda' };
  return [...porTienda.entries()].map(([storeId, items], idx) => ({
    storeId,
    storeLabel: labels[storeId] ?? `Tienda ${idx + 1}`,
    orderId: idx + 1,
    items,
    total: items.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
  }));
}

// ─── Store en memoria (modo mock) ─────────────────────────────────────────────
const mockStore = new Map<string, CartLineItem[]>();
const MOCK_STORES = ['2', '3'];
const MOCK_LABELS: Record<string, string> = { '2': 'Egrem', '3': 'Tienda prueba' };

function mockStoreIdPara(sku: string): string {
  let h = 0;
  for (const c of sku) h = (h + c.charCodeAt(0)) % MOCK_STORES.length;
  return MOCK_STORES[h];
}

function normalizarMock(accessToken: string, cartGroup = 'mock-group'): Cart {
  const lines = mockStore.get(accessToken) ?? [];
  const orders = linesToOrders(lines).map((o) => ({
    ...o,
    storeLabel: MOCK_LABELS[o.storeId] ?? o.storeLabel,
  }));
  return normalizar(orders, cartGroup);
}

// ─── API real (Drupal Commerce + NodeHive) ───────────────────────────────────
async function cartApiFetch<T = unknown>(
  path: string,
  auth: CartAuth,
  init: RequestInit = {},
  accept = 'application/json',
): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: accept,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.accessToken}`,
      'X-Auth-Token': getApiKeyValue() || '',
      ...(auth.sessionCookie ? { Cookie: sessionCookieHeader(auth.sessionCookie)! } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cart request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Lectura/escritura de order items vía JSON:API (sin tocar Drupal) ──────────
// El endpoint `/api/cart` no expone `item_id` por línea (§1.4), pero el cliente
// autenticado SÍ puede leer y modificar sus propios order items vía JSON:API.
// Lo usamos para habilitar − / eliminar en modo real sin cambios en el backend.
async function orderItemApiFetch<T = unknown>(
  path: string,
  auth: CartAuth,
  init: RequestInit = {},
): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/jsonapi/${path}`;
  const isWrite = init.method && init.method.toUpperCase() !== 'GET';
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${auth.accessToken}`,
      'X-Auth-Token': getApiKeyValue() || '',
      ...(auth.sessionCookie ? { Cookie: sessionCookieHeader(auth.sessionCookie)! } : {}),
      // Drupal exige X-CSRF-Token en escrituras JSON:API (sino 403 "Cross-site").
      ...(isWrite && auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Order item request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

interface RealOrderResponse {
  store_id: string;
  store_label: string;
  order_id: number;
  items: { sku: string; title: string; quantity: number; unit_price: number }[];
  total: number;
}
interface RealCartResponse {
  cart_group?: string;
  orders: RealOrderResponse[];
}

function parseRealCart(data: RealCartResponse | null): Cart {
  if (!data || !Array.isArray(data.orders)) {
    return { cartGroup: data?.cart_group ?? null, orders: [], subtotal: 0, count: 0 };
  }
  const orders: CartGroupOrder[] = data.orders.map((o) => ({
    storeId: o.store_id,
    storeLabel: o.store_label,
    orderId: o.order_id,
    total: o.total,
    items: o.items.map((it) => ({
      itemId: (it as Record<string, unknown>).item_id as string | undefined ??
        (it as Record<string, unknown>).id as string | undefined,
      sku: it.sku,
      title: it.title,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      imagen: null,
      talla: null,
      color: null,
      edicion: null,
      formato: null,
      storeId: o.store_id,
    })),
  }));
  return normalizar(orders, data.cart_group ?? null);
}

export async function getCart(auth: CartAuth, cartGroup?: string | null): Promise<Cart> {
  if (!USAR_REAL) return normalizarMock(auth.accessToken);
  try {
    const path = cartGroup ? `api/cart?cart_group=${encodeURIComponent(cartGroup)}` : `api/cart`;
    const data = await cartApiFetch<RealCartResponse>(path, auth);
    const cart = parseRealCart(data);
    // El endpoint real no devuelve imagen/variación/stock por línea: lo enriquecemos
    // con el catálogo (misma fuente de stock que la ficha de detalle).
    await enriquecerLineas(cart, auth.lang ?? 'es');
    // Tampoco devuelve `item_id` por línea: lo resolvemos vía JSON:API para
    // habilitar − / eliminar sin cambios en el backend.
    await enriquecerItemIds(cart, auth);
    return cart;
  } catch (e) {
    console.warn('[carrito] getCart real falló, devolviendo carrito vacío:', e);
    return { cartGroup: null, orders: [], subtotal: 0, count: 0 };
  }
}

// Mapa sku → variación del catálogo (cache 5 min) para enriquecer las líneas del
// carrito real, que no traen imagen, atributos de variación ni stock por tienda.
let skuVariacionCache: { at: number; lang: string; map: Map<string, ProductoVariacion> } | null =
  null;
async function getSkuVariacionMap(lang: string): Promise<Map<string, ProductoVariacion>> {
  if (
    skuVariacionCache &&
    skuVariacionCache.lang === lang &&
    Date.now() - skuVariacionCache.at < 5 * 60 * 1000
  ) {
    return skuVariacionCache.map;
  }
  const catalogo = await fetchProductosMerchDetalle(lang);
  const map = new Map<string, ProductoVariacion>();
  for (const p of catalogo.productos) {
    for (const v of p.variaciones ?? []) map.set(v.sku, v);
  }
  skuVariacionCache = { at: Date.now(), lang, map };
  return map;
}

/**
 * Enriquece cada línea con la imagen, los atributos de variación y —sobre todo—
 * el `stock` disponible en su tienda, leyendo el mismo catálogo que la ficha de
 * detalle. Así el slider del carrito puede respetar estrictamente la misma "ley"
 * de stock (máx = stock de la tienda menos lo ya en el carrito) que el resto.
 */
async function enriquecerLineas(cart: Cart, lang: string): Promise<void> {
  const map = await getSkuVariacionMap(lang);
  for (const o of cart.orders) {
    for (const l of o.items) {
      const v = map.get(l.sku);
      if (!v) continue;
      if (!l.imagen) l.imagen = v.imagenVarianteUrl ?? v.imagenes?.[0] ?? null;
      if (l.talla == null) l.talla = v.talla ?? null;
      if (l.color == null) l.color = v.color?.nombre ?? null;
      if (l.edicion == null) l.edicion = v.edicion ?? null;
      if (l.formato == null) l.formato = v.formato ?? null;
      const st = v.stockPorTienda?.find((s) => s.tienda.id === l.storeId);
      l.stock = st ? (st.ilimitado ? null : st.cantidad) : null;
    }
  }
}

/**
 * En modo real el endpoint `/api/cart` no devuelve un `item_id` por línea (§1.4),
 * pero el cliente autenticado puede leer su propia order vía JSON:API y mapear
 * cada `order_item` a su línea por `sku`. Así `line.itemId` queda poblado y el
 * botón − / eliminar funcionan sin tocar Drupal. Falla silenciosamente (la línea
 * simplemente queda sin `itemId` y el − deshabilitado) si no hay permiso.
 */
async function enriquecerItemIds(cart: Cart, auth: CartAuth): Promise<void> {
  if (!USAR_REAL || cart.orders.length === 0) return;
  await Promise.all(
    cart.orders.map(async (order) => {
      if (order.orderId == null) return;
      try {
        const data = await orderItemApiFetch<{
          included?: Array<{ id: string; type: string; attributes?: Record<string, any>; relationships?: Record<string, any> }>;
        }>(
          `commerce_order/default?filter[order_id]=${order.orderId}&include=order_items,order_items.purchased_entity`,
          auth,
        );
        const included = data.included ?? [];
        // variation uuid -> sku
        const skuPorVariacion = new Map<string, string>();
        for (const inc of included) {
          if (inc.type.startsWith('commerce_product_variation')) {
            const sku = inc.attributes?.sku as string | undefined;
            if (sku) skuPorVariacion.set(inc.id, sku);
          }
        }
        // order_item uuid -> sku
        const itemIdPorSku = new Map<string, string>();
        for (const inc of included) {
          if (inc.type.startsWith('commerce_order_item')) {
            const varRef = inc.relationships?.purchased_entity?.data;
            const sku = varRef?.id ? skuPorVariacion.get(varRef.id) : undefined;
            if (sku && inc.id) itemIdPorSku.set(sku, inc.id);
          }
        }
        for (const l of order.items) {
          const id = itemIdPorSku.get(l.sku);
          if (id) l.itemId = id;
        }
      } catch (e) {
        console.warn('[carrito] enriquecerItemIds falló para order', order.orderId, e);
      }
    }),
  );
}

export async function addToCart(
  items: AddToCartInput[],
  auth: CartAuth,
  cartGroup?: string | null,
): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = mockStore.get(auth.accessToken) ?? [];
    for (const item of items) {
      const storeId = item.storeId ?? mockStoreIdPara(item.sku ?? String(item.variationId ?? ''));
      const nueva: CartLineItem = {
        itemId: item.variationUuid ?? String(item.variationId ?? Math.random()),
        sku: item.sku ?? '',
        title: item.title ?? `Variación ${item.variationId}`,
        quantity: item.quantity,
        unitPrice: item.precioUnitario ?? 0,
        imagen: item.imagen ?? null,
        talla: item.talla ?? null,
        color: item.color ?? null,
        edicion: item.edicion ?? null,
        formato: item.formato ?? null,
        variationUuid: item.variationUuid ?? null,
        storeId,
      };
      const idx = lines.findIndex((l) => l.variationUuid === nueva.variationUuid && l.storeId === storeId);
      if (idx >= 0) lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + item.quantity };
      else lines.push(nueva);
    }
    mockStore.set(auth.accessToken, lines);
    return normalizarMock(auth.accessToken);
  }

  const body: Record<string, unknown> = {
    sku: items[0]?.sku,
    // El cliente puede enviar `storeId` (AddToCartInput) o `store_id` (Drupal);
    // toleramos ambos para no perder el campo y que Drupal responda 400.
    store_id: items[0]?.storeId ?? (items[0] as unknown as Record<string, unknown>)?.store_id,
    quantity: items[0]?.quantity,
  };
  if (cartGroup) body.cart_group = cartGroup;
  try {
    const data = await cartApiFetch<RealCartResponse>('api/cart/add', auth, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return parseRealCart(data);
  } catch (e) {
    const msg = String((e as Error)?.message ?? '');
    if (/40[39]/.test(msg)) {
      const disponible = Number(msg.match(/(\d+)/)?.[1] ?? '0');
      throw new Error(`STOCK_INSUFFICIENT:${disponible}`);
    }
    throw e;
  }
}

/**
 * Stopgap (plan §1.4): vaciar el pedido completo de una tienda usando `order_id`
 * (que SÍ viene en la respuesta). Mientras el backend no exponga `item_id` por
 * línea, no podemos borrar una línea puntual. Se usa JSON:API para borrar la
 * order de esa tienda.
 */
export async function removeCartStore(
  orderId: number,
  auth: CartAuth,
  cartGroup?: string | null,
): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = mockStore.get(auth.accessToken) ?? [];
    const target = linesToOrders(lines).find((o) => o.orderId === orderId);
    const storeId = target?.storeId;
    const filtered = lines.filter((l) => l.storeId !== storeId);
    mockStore.set(auth.accessToken, filtered);
    return normalizarMock(auth.accessToken);
  }
  try {
    // Stopgap (plan §1.4): borrar la order completa de la tienda vía JSON:API.
    // Drupal JSON:API exige `Accept: application/vnd.api+json` (de lo contrario
    // responde 406 Not Acceptable) Y el UUID de la order en la ruta, no el
    // `order_id` numérico (pasarlo da 404 "entity parameter was not converted").
    // Resolvemos el UUID consultando la colección filtrada por order_id.
    const list = await cartApiFetch<{
      data?: { id: string; attributes?: { drupal_internal__order_id?: number } }[];
    }>(
      `jsonapi/commerce_order/default?filter[drupal_internal__order_id][condition][path]=drupal_internal__order_id&filter[drupal_internal__order_id][condition][value]=${orderId}`,
      auth,
      {},
      'application/vnd.api+json',
    );
    const uuid = list.data?.find((o) => o.attributes?.drupal_internal__order_id === orderId)?.id;
    if (!uuid) {
      console.warn('[carrito] removeCartStore: no se encontró UUID para order_id', orderId);
    } else {
      await cartApiFetch(
        `jsonapi/commerce_order/default/${uuid}`,
        auth,
        { method: 'DELETE', headers: { 'X-CSRF-Token': auth.csrfToken ?? '' } },
        'application/vnd.api+json',
      );
    }
  } catch (e) {
    console.warn('[carrito] removeCartStore falló:', e);
  }
  // Tras borrar, el grupo sigue existiendo; re-leemos para reflejar el cambio.
  return getCart(auth, cartGroup);
}

// ─── Funciones de línea (bloqueadas por §1.4 en modo real) ───────────────────
// `itemId` solo existe en modo mock (o cuando el backend lo agregue). En modo
// real estas llamadas no se usan desde la UI hasta que haya `item_id`.
export async function updateCartItem(
  itemId: string,
  quantity: number,
  auth: CartAuth,
  cartGroup?: string | null,
): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = mockStore.get(auth.accessToken) ?? [];
    const idx = lines.findIndex((l) => (l.itemId ?? l.sku) === itemId);
    if (idx >= 0) lines[idx] = { ...lines[idx], quantity: Math.max(1, quantity) };
    mockStore.set(auth.accessToken, lines);
    return normalizarMock(auth.accessToken);
  }
  // Modo real: PATCH al order item vía JSON:API (el backend no expone `item_id`
  // en /api/cart, pero el cliente puede editar sus propios order items).
  await orderItemApiFetch(`commerce_order_item/default/${itemId}`, auth, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'commerce_order_item--default',
        id: itemId,
        attributes: { quantity: `${Math.max(1, quantity)}.00` },
      },
    }),
  });
  return getCart(auth, cartGroup ?? null);
}

export async function removeCartItem(
  itemId: string,
  auth: CartAuth,
  cartGroup?: string | null,
): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = (mockStore.get(auth.accessToken) ?? []).filter((l) => (l.itemId ?? l.sku) !== itemId);
    mockStore.set(auth.accessToken, lines);
    return normalizarMock(auth.accessToken);
  }
  // Modo real: DELETE del order item vía JSON:API.
  await orderItemApiFetch(`commerce_order_item/default/${itemId}`, auth, {
    method: 'DELETE',
  });
  return getCart(auth, cartGroup ?? null);
}

export async function checkoutCart(cartGroup: string, auth: CartAuth): Promise<unknown> {
  return cartApiFetch('api/cart/checkout', auth, {
    method: 'POST',
    body: JSON.stringify({ cart_group: cartGroup }),
  });
}
