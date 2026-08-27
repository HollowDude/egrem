/**
 * Carrito de Drupal Commerce (adaptado a Bearer, no a cookie `drupal_s`).
 *
 * Funciones reales: `getCart`, `addToCart`, `updateCartItem`, `removeCartItem`.
 * Requieren `Authorization: Bearer ${accessToken}` + `X-CSRF-Token` (salvo GET).
 *
 * Contrato confirmado contra el Drupal de dev (http://127.0.0.1:58727):
 *  - POST /{lang}/jsonapi/cart/add
 *      body: { data: [{ type: "commerce_product_variation--{bundle}", id: "<uuid>" }] }
 *      headers: Content-Type/Accept application/vnd.api+json, Authorization Bearer, X-CSRF-Token
 *      respuesta: data = array de order items (commerce_order_item--default)
 *  - GET /{lang}/jsonapi/commerce_order/default?filter[cart][condition][path]=cart&filter[cart][condition][value]=1
 *      devuelve la order-cart del usuario (view own commerce_order).
 *  - PATCH/DELETE /{lang}/jsonapi/commerce_order_item/default/{id}
 *
 * El flag `CART_REAL === 'true'` habilita el camino real; si no, se usa un
 * store en memoria (QA sin backend).
 */
 import { getBaseUrlValue } from '@/lib/nodehive/client';
import { resolveRelIds } from '@/lib/nodehive/helpers';
import { parseMediaImage } from '@/lib/nodehive/parsers';

export interface CartLine {
  id: string; // order item id (uuid real) o variationId en modo mock
  orderItemId?: string; // uuid del order item (real)
  variationId: number | null; // drupal_internal__variation_id
  variationUuid?: string; // uuid de la variación (real)
  bundle?: string | null;
  sku: string | null;
  title: string;
  talla: string | null;
  color: string | null;
  edicion: string | null;
  formato: string | null;
  cantidad: number;
  precioUnitario: number | null;
  imagen: string | null;
  href?: string;
  stock?: number | null; // stock disponible de la variación (modo real); undefined en mock
}

export interface Cart {
  orderId: string | null;
  lines: CartLine[];
  subtotal: number | null;
  count: number;
}

export interface AddToCartInput {
  variationId?: number; // drupal_internal (mock + lookup)
  variationUuid?: string; // uuid Drupal (modo real)
  bundle: string; // 'prenda' | 'accesorio' | 'entrada_evento' | 'libro' | 'instrumento' | 'disco'
  quantity: number;
  talla?: string;
  color?: string;
  edicion?: string;
  formato?: string;
  sku?: string;
  title?: string;
  precioUnitario?: number;
  imagen?: string;
}

export interface CartAuth {
  accessToken: string;
  csrfToken?: string;
  lang?: 'es' | 'en';
  uid?: string | number;
}

const USAR_REAL = import.meta.env.CART_REAL === 'true';

// ─── Store en memoria (modo mock) ──────────────────────────────────────────
const store = new Map<string, CartLine[]>();

function resolverLineaMock(item: AddToCartInput): CartLine {
  const id = item.variationId ?? 0;
  return {
    id: String(id),
    variationId: id,
    variationUuid: item.variationUuid,
    sku: item.sku ?? null,
    title: item.title ?? `Variación ${id}`,
    talla: item.talla ?? null,
    color: item.color ?? null,
    edicion: item.edicion ?? null,
    formato: item.formato ?? null,
    cantidad: item.quantity,
    precioUnitario: item.precioUnitario ?? null,
    imagen: item.imagen ?? null,
  };
}

function normalizar(lines: CartLine[]): Cart {
  const subtotal = lines.reduce(
    (acc, l) => acc + (l.precioUnitario !== null ? l.precioUnitario * l.cantidad : 0),
    0,
  );
  const count = lines.reduce((acc, l) => acc + l.cantidad, 0);
  const subtotalFinal = lines.some((l) => l.precioUnitario === null) ? null : subtotal;
  return { orderId: null, lines, subtotal: subtotalFinal, count };
}

// ─── API real (Drupal Commerce + Bearer) ───────────────────────────────────
async function commerceFetch<T = unknown>(
  path: string,
  auth: CartAuth,
  init: RequestInit = {},
): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/jsonapi/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      ...(init.method && init.method !== 'GET'
        ? { 'Content-Type': 'application/vnd.api+json' }
        : {}),
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Commerce request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

interface JsonApiResource {
  type: string;
  id: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, { data: any }>;
}

function includedMap(res: { included?: JsonApiResource[] }): Map<string, JsonApiResource> {
  const m = new Map<string, JsonApiResource>();
  for (const r of res.included ?? []) m.set(`${r.type}:${r.id}`, r);
  return m;
}

// `/jsonapi/commerce_order/default` devuelve JSON:API estándar:
//   { data: [ order ], included: [ order_items, variations, ... ] }
// El order trae `relationships.order_items.data` (refs) y los order items
// resuelven su `purchased_entity` (la variación) desde `included`.
// También soporta el caso de array plano con order_items embebidos.
export function parseCartResponse(res: unknown, base: string): Cart {
  const rawOrders = Array.isArray(res) ? res : (res as any)?.data;
  const included = Array.isArray(res) ? [] : ((res as any)?.included ?? []);
  const orders = Array.isArray(rawOrders) ? (rawOrders as any[]) : [];
  const map = includedMap({ included });
  const lines: CartLine[] = [];

  for (const order of orders) {
    const refs = order?.relationships?.order_items?.data ?? [];
    const items: any[] = Array.isArray(order?.order_items)
      ? order.order_items
      : (refs
          .map((r: any) => map.get(`${r.type}:${r.id}`))
          .filter(Boolean) as any[]);

    for (const oi of items) {
      const a = oi?.attributes ?? {};
      const peRef = oi?.relationships?.purchased_entity?.data;
      const pe = peRef ? map.get(`${peRef.type}:${peRef.id}`) : oi?.purchased_entity ?? null;
      const pa = pe?.attributes ?? {};

      const tallaRef = pe?.relationships?.attribute_talla?.data;
      const tallaRes = tallaRef ? map.get(`${tallaRef.type}:${tallaRef.id}`) : null;
      const colorRef = pe?.relationships?.attribute_color?.data;
      const colorRes = colorRef ? map.get(`${colorRef.type}:${colorRef.id}`) : null;
      const imgRelIds = resolveRelIds(pe?.relationships?.field_imagen);
      const imagenUrl = (() => {
        if (!imgRelIds.length) return null;
        const imgRes = map.get(`${imgRelIds[0].type}:${imgRelIds[0].id}`);
        if (!imgRes) return null;
        if (imgRes.type === 'file--file') {
          const u = (imgRes.attributes?.uri as { url?: string } | undefined)?.url;
          if (!u) return null;
          return u.startsWith('http') ? u : `${base.replace(/\/$/, '')}${u}`;
        }
        const parsed = parseMediaImage(imgRes as any, included);
        return parsed?.url ?? null;
      })();

      const bundle = (pe?.type ?? '').replace('commerce_product_variation--', '') || null;
      const unitRaw = a.unit_price?.number ?? pa.price?.number ?? null;
      lines.push({
        id: oi.id ?? a.uuid ?? String(a.order_item_id ?? ''),
        orderItemId: oi.id ?? a.uuid,
        variationId: pa.drupal_internal__variation_id ?? pe?.variation_id ?? null,
        variationUuid: pe?.id ?? pe?.uuid,
        bundle,
        sku: pa.sku ?? pe?.sku ?? null,
        title: a.title ?? pa.title ?? 'Producto',
        talla: tallaRes?.attributes?.name ?? null,
        color: colorRes?.attributes?.name ?? null,
        edicion: null,
        formato: null,
        cantidad: parseFloat(String(a.quantity ?? '1')),
        precioUnitario: unitRaw !== null ? parseFloat(unitRaw) : null,
        imagen: imagenUrl,
      });
    }
  }

  const subtotal = lines.reduce(
    (acc, l) => acc + (l.precioUnitario !== null ? l.precioUnitario * l.cantidad : 0),
    0,
  );
  return {
    orderId: orders[0]?.id ?? null,
    lines,
    subtotal,
    count: lines.reduce((acc, l) => acc + l.cantidad, 0),
  };
}

export async function getCart(auth: CartAuth): Promise<Cart> {
  if (!USAR_REAL) return normalizar(store.get(auth.accessToken) ?? []);
  const base = getBaseUrlValue();
  const uidFilter =
    auth.uid != null
      ? '&filter[uid][condition][path]=uid.meta.drupal_internal__target_id' +
        `&filter[uid][condition][value]=${auth.uid}`
      : '';
  const query =
    'filter[cart][condition][path]=cart&filter[cart][condition][value]=1' +
    uidFilter +
    '&include=order_items,order_items.purchased_entity,' +
    'order_items.purchased_entity.field_imagen.field_media_image';
  try {
    const res = await commerceFetch(`commerce_order/default?${query}`, auth);
    const cart = parseCartResponse(res, base);
    return await enrichCartLines(cart, auth);
  } catch (e) {
    // Sin carrito (o el pedido-aún-no-existe) se trata como carrito vacío.
    console.warn('[carrito] getCart real falló, devolviendo carrito vacío:', e);
    return { orderId: null, lines: [], subtotal: 0, count: 0 };
  }
}

// Drupal 400si incluimos un atributo que no aplica al bundle de la variación,
// por eso NO se incluyen attribute_* en el query del carrito (mezcla de bundles
// 400earía). En su lugar enriquecemos edicion/formato/talla/color por bundle en
// una segunda pasada (una petición por bundle presente en el carrito).
const ATTR_INCLUDE_POR_BUNDLE: Record<string, string> = {
  prenda: 'attribute_talla,attribute_color',
  accesorio: 'attribute_color',
  libro: 'attribute_edicion',
  disco: 'attribute_edicion,attribute_formato,field_stock_level',
  instrumento: '',
};

async function enrichCartLines(cart: Cart, auth: CartAuth): Promise<Cart> {
  if (!USAR_REAL || cart.lines.length === 0) return cart;
  const porBundle = new Map<string, string[]>();
  for (const l of cart.lines) {
    if (!l.variationUuid || !l.bundle) continue;
    const arr = porBundle.get(l.bundle) ?? [];
    arr.push(l.variationUuid);
    porBundle.set(l.bundle, arr);
  }
  if (porBundle.size === 0) return cart;

  const attrsPorUuid = new Map<
    string,
    {
      talla: string | null;
      color: string | null;
      edicion: string | null;
      formato: string | null;
      stock?: number | null;
    }
  >();
  await Promise.all(
    [...porBundle.entries()].map(async ([bundle, uuids]) => {
      const inc = ATTR_INCLUDE_POR_BUNDLE[bundle];
      try {
        const path =
          `commerce_product_variation/${bundle}` +
          `?filter[id][condition][path]=id` +
          `&filter[id][condition][operator]=IN` +
          uuids.map((u) => `&filter[id][condition][value][]=${u}`).join('') +
          (inc ? `&include=${inc}` : '');
        const res = await commerceFetch<{ data: JsonApiResource[]; included?: JsonApiResource[] }>(
          path,
          auth,
        );
        const map = includedMap(res);
        for (const v of res.data ?? []) {
          const getAttr = (rel: string): string | null => {
            const ref = v.relationships?.[rel]?.data;
            const r = ref ? map.get(`${ref.type}:${ref.id}`) : null;
            return r?.attributes?.name ?? null;
          };
          const va = (v.attributes ?? {}) as Record<string, any>;
          const sVal = va.field_stock_level?.available_stock;
          attrsPorUuid.set(v.id, {
            talla: getAttr('attribute_talla'),
            color: getAttr('attribute_color'),
            edicion: getAttr('attribute_edicion'),
            formato: getAttr('attribute_formato'),
            stock: sVal == null ? null : Number(sVal),
          });
        }
      } catch {
        // Si falla el enriquecimiento de un bundle, dejamos la línea sin atributos.
      }
    }),
  );

  const lines = cart.lines.map((l) => {
    const attrs = l.variationUuid ? attrsPorUuid.get(l.variationUuid) : undefined;
    return attrs ? { ...l, ...attrs } : l;
  });
  return { ...cart, lines };
}

/**
 * Stock disponible de una variación (modo real). Devuelve `null` cuando el stock
 * es ilimitado/desconocido o no se puede leer — en ese caso NO se bloquea la
 * compra (fail-open) para no romper el checkout si el stock no responde.
 */
async function obtenerStockVariacion(
  auth: CartAuth,
  uuid: string,
  bundle: string,
): Promise<number | null> {
  try {
    const res = await commerceFetch<{ data: JsonApiResource | JsonApiResource[] }>(
      `commerce_product_variation/${bundle}` +
        `?filter[id][condition][path]=id` +
        `&filter[id][condition][operator]=%3D` +
        `&filter[id][condition][value]=${uuid}`,
      auth,
    );
    const lista = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const a = lista[0]?.attributes as Record<string, any> | undefined;
    if (!a) return null;
    if (a.commerce_stock_always_in_stock === true) return null;
    if (a.status === false) return 0;
    const s = a.field_stock_level?.available_stock;
    return s == null ? null : Number(s);
  } catch {
    return null;
  }
}

export async function addToCart(items: AddToCartInput[], auth: CartAuth): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = store.get(auth.accessToken) ?? [];
    for (const item of items) {
      const idx = lines.findIndex((l) => l.variationId === item.variationId);
      const nueva = resolverLineaMock(item);
      if (idx >= 0)
        lines[idx] = { ...lines[idx], cantidad: lines[idx].cantidad + item.quantity };
      else lines.push(nueva);
    }
    store.set(auth.accessToken, lines);
    return normalizar(lines);
  }
  if (!auth.csrfToken) throw new Error('addToCart requiere csrfToken');
  const current = await getCart(auth);
  for (const item of items) {
    if (!item.variationUuid) throw new Error('addToCart (real) requiere variationUuid');
    const ocupado = current.lines.find((l) => l.variationUuid === item.variationUuid)?.cantidad ?? 0;
    const stock = await obtenerStockVariacion(auth, item.variationUuid, item.bundle);
    if (stock != null && ocupado + item.quantity > stock) {
      throw new Error(`STOCK_INSUFFICIENT:${Math.max(0, stock - ocupado)}`);
    }
    const existing = current.lines.find((l) => l.variationUuid === item.variationUuid);
    if (existing && existing.orderItemId) {
      const target = existing.cantidad + item.quantity;
      await commerceFetch(
        `commerce_order_item/default/${existing.orderItemId}`,
        auth,
        {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'commerce_order_item--default',
              id: existing.orderItemId,
              attributes: { quantity: target },
            },
          }),
        },
      );
    } else {
      const addRes = await commerceFetch<{ data: JsonApiResource[] }>('cart/add', auth, {
        method: 'POST',
        body: JSON.stringify({
          data: [{ type: `commerce_product_variation--${item.bundle}`, id: item.variationUuid }],
        }),
      });
      const created = addRes.data?.[0];
      if (created && item.quantity > 1) {
        await commerceFetch(
          `commerce_order_item/default/${created.id}`,
          auth,
          {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                type: 'commerce_order_item--default',
                id: created.id,
                attributes: { quantity: item.quantity },
              },
            }),
          },
        );
      }
    }
  }
  return getCart(auth);
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  auth: CartAuth,
): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = store.get(auth.accessToken) ?? [];
    const idx = lines.findIndex((l) => l.id === itemId);
    if (idx >= 0) lines[idx] = { ...lines[idx], cantidad: Math.max(1, quantity) };
    store.set(auth.accessToken, lines);
    return normalizar(lines);
  }
  if (!auth.csrfToken) throw new Error('updateCartItem requiere csrfToken');
  const current = await getCart(auth);
  const line = current.lines.find((l) => (l.orderItemId ?? l.id) === itemId);
  if (line?.variationUuid && line.bundle) {
    const stock = await obtenerStockVariacion(auth, line.variationUuid, line.bundle);
    if (stock != null && quantity > stock) {
      throw new Error(`STOCK_INSUFFICIENT:${Math.max(0, stock)}`);
    }
  }
  await commerceFetch(`commerce_order_item/default/${itemId}`, auth, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'commerce_order_item--default',
        id: itemId,
        attributes: { quantity: Math.max(1, quantity) },
      },
    }),
  });
  return getCart(auth);
}

export async function removeCartItem(itemId: string, auth: CartAuth): Promise<Cart> {
  if (!USAR_REAL) {
    const lines = (store.get(auth.accessToken) ?? []).filter((l) => l.id !== itemId);
    store.set(auth.accessToken, lines);
    return normalizar(lines);
  }
  if (!auth.csrfToken) throw new Error('removeCartItem requiere csrfToken');
  try {
    await commerceFetch(`commerce_order_item/default/${itemId}`, auth, { method: 'DELETE' });
  } catch (e) {
    // Si la línea ya no existe (404), se asume eliminada y seguimos.
    if (!String(e).includes('404')) throw e;
  }
  return getCart(auth);
}
