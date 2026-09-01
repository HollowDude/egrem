import { getApiKeyValue, getBaseUrlValue } from './client';

export interface PedidoAuth {
  uid: string;
  accessToken: string;
  csrfToken: string;
  sessionCookie: string;
  lang?: 'es' | 'en';
}

export type PedidoTab = 'realizados' | 'en_proceso';

export interface PedidoResumen {
  uuid: string;
  orderId: number;
  state: string;
  placed: string | null;
  total: number;
  storeLabel?: string;
}

export interface PedidoDetalle extends PedidoResumen {
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    imagen?: string | null;
  }>;
  direccion?: { addressLine1: string; locality: string; administrativeArea: string; postalCode?: string };
  puedeCancelar: boolean;
  puedeBorrar: boolean;
}

function sessionCookieHeader(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function pedidoFetch<T = unknown>(path: string, auth: PedidoAuth, init: RequestInit = {}): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/jsonapi/${path}`;
  const isWrite = init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase());
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${auth.accessToken}`,
      'X-Auth-Token': getApiKeyValue() || '',
      ...(auth.sessionCookie ? { Cookie: sessionCookieHeader(auth.sessionCookie)! } : {}),
      ...(isWrite && auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pedido request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function parsePedidoResumen(
  resource: Record<string, unknown>,
  included: Record<string, unknown>[],
): PedidoResumen {
  const attrs = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, unknown> | undefined;

  // store label via included store_id
  let storeLabel: string | undefined;
  const storeRel = (rels?.store_id as { data?: { type: string; id: string } } | undefined)?.data;
  if (storeRel) {
    const storeRes = included.find((i) => (i as { id: string }).id === storeRel.id) as
      | { attributes?: Record<string, unknown> }
      | undefined;
    storeLabel = (storeRes?.attributes?.label as string) ?? (storeRes?.attributes?.name as string);
  }

  return {
    uuid: resource.id as string,
    orderId: (attrs.drupal_internal__order_id as number) ?? (attrs.order_id as number) ?? 0,
    state: (attrs.state as string) ?? (attrs.order_state as string) ?? 'draft',
    placed: (attrs.placed as string) ?? (attrs.created as string) ?? null,
    total: parseFloat(((attrs.total_price as { number?: string } | undefined)?.number as string) ?? '0') || 0,
    storeLabel,
  };
}

function resolveDireccion(included: Record<string, unknown>[]): PedidoDetalle['direccion'] {
  const profile = included.find((i) => (i as { type: string }).type === 'profile--customer') as
    | { attributes?: Record<string, unknown> }
    | undefined;
  const raw = (profile?.attributes?.address as Record<string, unknown> | undefined) ?? undefined;
  if (!raw) return undefined;
  return {
    addressLine1: (raw.address_line1 as string) ?? '',
    locality: (raw.locality as string) ?? '',
    administrativeArea: (raw.administrative_area as string) ?? '',
    postalCode: (raw.postal_code as string) ?? '',
  };
}

function parsePedidoDetalle(
  resource: Record<string, unknown>,
  included: Record<string, unknown>[],
): PedidoDetalle {
  const base = parsePedidoResumen(resource, included);
  const attrs = resource.attributes as Record<string, unknown>;

  // items: look for order_items in included
  const orderItems = included.filter((i) => (i as { type: string }).type === 'commerce_order_item--default') as Array<{
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  }>;

  const items = orderItems.map((oi) => {
    const a = oi.attributes as Record<string, unknown>;
    const qty = parseFloat(String(a.quantity ?? '1'));
    const unitPrice = parseFloat(((a.unit_price as { number?: string } | undefined)?.number as string) ?? '0') || 0;
    const title = (a.title as string) ?? (a.label as string) ?? 'Producto';

    // try to resolve imagen via purchased_entity -> field_imagen
    let imagen: string | null = null;
    const peRel = oi.relationships?.purchased_entity as { data?: { type: string; id: string } } | undefined;
    if (peRel?.data) {
      const pe = included.find((i) => (i as { id: string }).id === peRel.data!.id) as
        | { relationships?: Record<string, unknown> }
        | undefined;
      const imgRel = pe?.relationships?.field_imagen as { data?: { type: string; id: string } | { type: string; id: string }[] } | undefined;
      const imgId = Array.isArray(imgRel?.data) ? imgRel.data[0]?.id : (imgRel?.data as { id: string } | undefined)?.id;
      if (imgId) {
        const media = included.find((i) => (i as { id: string }).id === imgId) as
          | { relationships?: Record<string, unknown> }
          | undefined;
        const fileRel = media?.relationships?.field_media_image as { data?: { id: string } } | undefined;
        const fileId = fileRel?.data?.id;
        if (fileId) {
          const file = included.find((i) => (i as { id: string }).id === fileId) as
            | { attributes?: Record<string, unknown> }
            | undefined;
          const uri = (file?.attributes?.uri as { url?: string } | undefined)?.url;
          if (uri) {
            const baseUrl = getBaseUrlValue().replace(/\/$/, '');
            imagen = uri.startsWith('http') ? uri : `${baseUrl}${uri}`;
          }
        }
      }
    }

    return { title, quantity: qty, unitPrice, imagen };
  });

  // isLocked / puedeCancelar logic: try to find attribute that looks like locked
  const isLocked = (attrs as Record<string, unknown>).isLocked as boolean | undefined ?? (attrs as Record<string, unknown>).locked as boolean | undefined;
  const state = base.state;
  const puedeCancelar = state === 'draft' && isLocked !== true;
  const puedeBorrar = isLocked !== true;

  return {
    ...base,
    items,
    direccion: resolveDireccion(included),
    puedeCancelar,
    puedeBorrar,
  };
}

export async function listarPedidos(
  tab: PedidoTab,
  auth: PedidoAuth,
  cursor?: string | null,
): Promise<{ pedidos: PedidoResumen[]; nextCursor: string | null }> {
  const state = tab === 'realizados' ? 'completed' : 'draft';
  let path: string;

  if (cursor) {
    // cursor is the full next href or just the query string; use as-is if it looks like a URL
    if (cursor.startsWith('http')) {
      const base = getBaseUrlValue().replace(/\/$/, '');
      const lang = auth.lang ?? 'es';
      const prefix = `${base}/${lang}/jsonapi/`;
      path = cursor.startsWith(prefix) ? cursor.slice(prefix.length) : cursor;
    } else {
      path = cursor.replace(/^\//, '');
    }
  } else {
    // Sin filtro por uid: el endpoint ya devuelve solo los pedidos del usuario autenticado
    // (filtrar por uid.id con el ID numérico daba vacío; con UUID tampoco era fiable).
    path = `commerce_order/default?filter[cart][value]=0&filter[state][value]=${state}&include=billing_profile,order_items,store_id&sort=-placed&page[limit]=20`;
  }

  const data = await pedidoFetch<{
    data: Record<string, unknown>[];
    included?: Record<string, unknown>[];
    links?: { next?: { href: string } };
  }>(path, auth);

  const list = Array.isArray(data.data) ? data.data : [];
  const included = (data.included ?? []) as Record<string, unknown>[];
  const pedidos = list.map((r) => parsePedidoResumen(r as Record<string, unknown>, included));
  const nextCursor = data.links?.next?.href ?? null;
  return { pedidos, nextCursor };
}

export async function obtenerPedido(uuid: string, auth: PedidoAuth): Promise<PedidoDetalle> {
  const data = await pedidoFetch<{
    data: Record<string, unknown>;
    included?: Record<string, unknown>[];
  }>(`commerce_order/default/${uuid}?include=billing_profile,order_items.purchased_entity,order_items.purchased_entity.field_imagen,order_items.purchased_entity.field_imagen.field_media_image`, auth);

  const included = (data.included ?? []) as Record<string, unknown>[];
  return parsePedidoDetalle(data.data as Record<string, unknown>, included);
}

export async function cancelarPedido(uuid: string, auth: PedidoAuth): Promise<void> {
  await pedidoFetch(`commerce_order/default/${uuid}`, auth, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'commerce_order--default',
        id: uuid,
        attributes: { state: 'canceled' },
      },
    }),
  });
}

export async function borrarPedido(uuid: string, auth: PedidoAuth): Promise<void> {
  await pedidoFetch(`commerce_order/default/${uuid}`, auth, { method: 'DELETE' });
}
