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
import { MOCK_PRODUCTOS_DETALLE } from '@/lib/tienda/mockProductoDetalle';

export interface CartLine {
  id: string; // order item id (uuid real) o variationId en modo mock
  orderItemId?: string; // uuid del order item (real)
  variationId: number | null; // drupal_internal__variation_id
  variationUuid?: string; // uuid de la variación (real)
  sku: string | null;
  title: string;
  talla: string | null;
  color: string | null;
  cantidad: number;
  precioUnitario: number | null;
  imagen: string | null;
  href?: string;
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
  bundle: string; // 'prenda' | 'accesorio' | 'entrada_evento'
  quantity: number;
  talla?: string;
  color?: string;
  sku?: string;
  title?: string;
  precioUnitario?: number;
  imagen?: string;
}

export interface CartAuth {
  accessToken: string;
  csrfToken?: string;
  lang?: 'es' | 'en';
}

const USAR_REAL = import.meta.env.CART_REAL === 'true';

// ─── Store en memoria (modo mock) ──────────────────────────────────────────
const store = new Map<string, CartLine[]>();

function resolverLineaMock(item: AddToCartInput): CartLine {
  const id = item.variationId ?? 0;
  for (const p of MOCK_PRODUCTOS_DETALLE) {
    const v = p.variaciones.find((x) => x.variationId === id);
    if (v) {
      return {
        id: String(id),
        variationId: id,
        sku: v.sku,
        title: p.titulo,
        talla: v.talla,
        color: v.color?.nombre ?? null,
        cantidad: item.quantity,
        precioUnitario: v.precio,
        imagen: v.imagenVarianteUrl ?? v.imagenes[0] ?? p.imagenPrincipal,
        href: `/tienda/producto/${p.slug}`,
      };
    }
  }
  return {
    id: String(id),
    variationId: id,
    sku: item.sku ?? null,
    title: item.title ?? `Variación ${id}`,
    talla: item.talla ?? null,
    color: item.color ?? null,
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

function resolveImageUrl(base: string, uri?: string): string | null {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  return `${base.replace(/\/$/, '')}${uri}`;
}

function parseCart(order: JsonApiResource, map: Map<string, JsonApiResource>, base: string): Cart {
  const lines: CartLine[] = [];
  const oiRefs = order.relationships?.order_items?.data ?? [];
  for (const ref of oiRefs) {
    const oi = map.get(`${ref.type}:${ref.id}`) ?? (ref as JsonApiResource);
    if (!oi?.attributes) continue;
    const variationRef = oi.relationships?.purchased_entity?.data;
    const variation =
      variationRef && map.get(`${variationRef.type}:${variationRef.id}`);
    const imgRef = variation?.relationships?.field_imagen?.data;
    const imgRes = imgRef && map.get(`${imgRef.type}:${imgRef.id}`);
    const tallaRef = variation?.relationships?.attribute_talla?.data;
    const tallaRes = tallaRef && map.get(`${tallaRef.type}:${tallaRef.id}`);
    const colorRef = variation?.relationships?.attribute_color?.data;
    const colorRes = colorRef && map.get(`${colorRef.type}:${colorRef.id}`);
    lines.push({
      id: oi.id,
      orderItemId: oi.id,
      variationId: variation?.attributes?.drupal_internal__variation_id ?? null,
      variationUuid: variation?.id,
      sku: variation?.attributes?.sku ?? null,
      title: oi.attributes.title ?? variation?.attributes?.title ?? 'Producto',
      talla: tallaRes?.attributes?.name ?? null,
      color: colorRes?.attributes?.name ?? null,
      cantidad: parseFloat(oi.attributes.quantity ?? '1'),
      precioUnitario: oi.attributes.unit_price
        ? parseFloat(oi.attributes.unit_price.number)
        : null,
      imagen: resolveImageUrl(base, imgRes?.attributes?.uri?.url),
    });
  }
  const subtotal = lines.reduce((a, l) => a + (l.precioUnitario ?? 0) * l.cantidad, 0);
  return {
    orderId: order.id,
    lines,
    subtotal,
    count: lines.reduce((a, l) => a + l.cantidad, 0),
  };
}

export async function getCart(auth: CartAuth): Promise<Cart> {
  if (!USAR_REAL) return normalizar(store.get(auth.accessToken) ?? []);
  const base = getBaseUrlValue();
  const query =
    'filter[cart][condition][path]=cart&filter[cart][condition][value]=1' +
    '&include=order_items,order_items.purchased_entity,' +
    'order_items.purchased_entity.attribute_talla,' +
    'order_items.purchased_entity.attribute_color,' +
    'order_items.purchased_entity.field_imagen';
  const res = await commerceFetch<{ data: JsonApiResource[] | JsonApiResource; included?: JsonApiResource[] }>(
    `commerce_order/default?${query}`,
    auth,
  );
  const data = Array.isArray(res.data) ? res.data : [res.data];
  if (data.length === 0) return { orderId: null, lines: [], subtotal: 0, count: 0 };
  const order = data[0];
  const map = includedMap(res);
  return parseCart(order, map, base);
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
  await commerceFetch(`commerce_order_item/default/${itemId}`, auth, { method: 'DELETE' });
  return getCart(auth);
}
