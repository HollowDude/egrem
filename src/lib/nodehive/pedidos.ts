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
  checkoutStep: string | null;
  cartGroupUuid: string | null;
  placed: string | null;
  changed: string | null;
  total: number;
  storeLabel?: string;
  billingKey: string;
}

export interface PedidoBillingProfile {
  firstName: string;
  lastName: string;
  phone: string;
  ciPassport: string;
  address: { addressLine1: string; locality: string; administrativeArea: string; postalCode?: string } | null;
}

export interface PedidoDetalle extends PedidoResumen {
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    imagen?: string | null;
    talla?: string | null;
    color?: string | null;
    colorHex?: string | null;
    edicion?: string | null;
    formato?: string | null;
    sku?: string | null;
  }>;
  billingProfile: PedidoBillingProfile | null;
  direccion?: { addressLine1: string; locality: string; administrativeArea: string; postalCode?: string };
  puedeCancelar: boolean;
  puedeBorrar: boolean;
}

export interface PedidoHermano {
  uuid: string;
  orderId: number;
  state: string;
}

export interface PedidoAgrupado {
  /** UUID del primer pedido del grupo (usado como key y para links) */
  uuid: string;
  /** N.º visible: solo el primero, ej. 71 */
  orderId: number;
  /** Todos los orderIds del grupo, ej. [71,72] */
  orderIds: number[];
  /** Todos los uuids del grupo */
  uuids: string[];
  state: string;
  checkoutStep: string | null;
  cartGroupUuid: string | null;
  placed: string | null;
  total: number;
  pedidos: PedidoResumen[];
  storeLabels: string[];
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

function billingKeyFromAttrs(attrs: Record<string, unknown>): string {
  const bi = attrs.billing_information as Record<string, unknown> | undefined;
  if (!bi) return 'null';
  const addr = bi.address as Record<string, unknown> | undefined;
  return [
    (bi.field_first_name as string) ?? '',
    (bi.field_last_name as string) ?? '',
    typeof bi.field_phone === 'string' ? (bi.field_phone as string) : ((bi.field_phone as Record<string, unknown> | undefined)?.phone_number as string) ?? '',
    (bi.field_ci_passport as string) ?? '',
    addr ? `${addr.country_code ?? ''}|${addr.administrative_area ?? ''}|${addr.locality ?? ''}|${addr.address_line1 ?? ''}|${addr.postal_code ?? ''}` : 'no-addr',
  ].join('|');
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
    checkoutStep: (attrs.checkout_step as string) ?? null,
    cartGroupUuid: (attrs.field_cart_group_uuid as string) ?? null,
    placed: (attrs.placed as string) ?? (attrs.created as string) ?? null,
    changed: (attrs.changed as string) ?? null,
    total: parseFloat(((attrs.total_price as { number?: string } | undefined)?.number as string) ?? '0') || 0,
    storeLabel,
    billingKey: billingKeyFromAttrs(attrs),
  };
}

function resolveBillingProfile(
  included: Record<string, unknown>[],
  billingInfoAttr?: Record<string, unknown> | null,
): PedidoBillingProfile | null {
  // Prioridad: attributes.billing_information (JSONAPI expone el profile clonado ahí)
  if (billingInfoAttr && typeof billingInfoAttr === 'object') {
    const raw = billingInfoAttr.address as Record<string, unknown> | undefined;
    const phoneRaw = billingInfoAttr.field_phone as string | { phone_number?: string } | null | undefined;
    const phone = typeof phoneRaw === 'string' ? phoneRaw : (phoneRaw?.phone_number ?? '');
    // Si no hay datos relevantes, considerar nulo
    if (!raw && !billingInfoAttr.field_first_name && !billingInfoAttr.field_last_name) return null;
    return {
      firstName: (billingInfoAttr.field_first_name as string) ?? '',
      lastName: (billingInfoAttr.field_last_name as string) ?? '',
      phone,
      ciPassport: (billingInfoAttr.field_ci_passport as string) ?? '',
      address: raw
        ? {
            addressLine1: (raw.address_line1 as string) ?? '',
            locality: (raw.locality as string) ?? '',
            administrativeArea: (raw.administrative_area as string) ?? '',
            postalCode: (raw.postal_code as string) ?? '',
          }
        : null,
    };
  }
  const profile = included.find((i) => (i as { type: string }).type === 'profile--customer') as
    | { attributes?: Record<string, unknown> }
    | undefined;
  const attrs = profile?.attributes as Record<string, unknown> | undefined;
  if (!attrs) return null;
  const raw = attrs.address as Record<string, unknown> | undefined;
  const phoneRaw = attrs.field_phone as string | { phone_number?: string } | null | undefined;
  const phone = typeof phoneRaw === 'string' ? phoneRaw : (phoneRaw?.phone_number ?? '');
  return {
    firstName: (attrs.field_first_name as string) ?? '',
    lastName: (attrs.field_last_name as string) ?? '',
    phone,
    ciPassport: (attrs.field_ci_passport as string) ?? '',
    address: raw
      ? {
          addressLine1: (raw.address_line1 as string) ?? '',
          locality: (raw.locality as string) ?? '',
          administrativeArea: (raw.administrative_area as string) ?? '',
          postalCode: (raw.postal_code as string) ?? '',
        }
      : null,
  };
}

function resolveDireccion(included: Record<string, unknown>[]): PedidoDetalle['direccion'] {
  const bp = resolveBillingProfile(included);
  return bp?.address ?? undefined;
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
    const sku = (a.sku as string) ?? (a.purchased_entity_sku as string) ?? null;

    // try to resolve imagen y variaciones via purchased_entity
    let imagen: string | null = null;
    let talla: string | null = null;
    let color: string | null = null;
    let colorHex: string | null = null;
    let edicion: string | null = null;
    let formato: string | null = null;
    const peRel = oi.relationships?.purchased_entity as { data?: { type: string; id: string } } | undefined;
    if (peRel?.data) {
      const pe = included.find((i) => (i as { id: string }).id === peRel.data!.id) as
        | { attributes?: Record<string, unknown>; relationships?: Record<string, unknown> }
        | undefined;
      const peAttrs = pe?.attributes as Record<string, unknown> | undefined;
      // variaciones comunes
      talla = (peAttrs?.field_talla as string) ?? (peAttrs?.talla as string) ?? null;
      // color puede ser objeto con nombre/hex o string
      const colorRaw = peAttrs?.field_color ?? peAttrs?.color;
      if (colorRaw && typeof colorRaw === 'object') {
        const c = colorRaw as Record<string, unknown>;
        color = (c.nombre as string) ?? (c.name as string) ?? null;
        colorHex = (c.hex as string) ?? null;
      } else if (typeof colorRaw === 'string') {
        color = colorRaw;
      }
      // intentar también vía relaciones de color/talla si son entidades
      if (!color) {
        const colorRel = pe?.relationships?.field_color as { data?: { id: string } } | undefined;
        if (colorRel?.data) {
          const colorEnt = included.find((i) => (i as { id: string }).id === colorRel.data!.id) as { attributes?: Record<string, unknown> } | undefined;
          color = (colorEnt?.attributes?.name as string) ?? (colorEnt?.attributes?.label as string) ?? null;
          colorHex = (colorEnt?.attributes?.field_color_code as string) ?? (colorEnt?.attributes?.color as string) ?? null;
        }
      }
      if (!talla) {
        const tallaRel = pe?.relationships?.field_talla as { data?: { id: string } } | undefined;
        if (tallaRel?.data) {
          const tallaEnt = included.find((i) => (i as { id: string }).id === tallaRel.data!.id) as { attributes?: Record<string, unknown> } | undefined;
          talla = (tallaEnt?.attributes?.name as string) ?? (tallaEnt?.attributes?.label as string) ?? null;
        }
      }
      edicion = (peAttrs?.field_edicion as string) ?? (peAttrs?.edicion as string) ?? null;
      formato = (peAttrs?.field_formato as string) ?? (peAttrs?.formato as string) ?? null;
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
    // fallback: intentar desde atributos del order_item si tiene info de variación
    if (!talla) talla = (a.field_talla as string) ?? null;
    if (!color) color = (a.field_color as string) ?? null;
    if (!edicion) edicion = (a.field_edicion as string) ?? null;
    if (!formato) formato = (a.field_formato as string) ?? null;

    return { title, quantity: qty, unitPrice, imagen, talla, color, colorHex, edicion, formato, sku };
  });

  // isLocked / puedeCancelar logic: try to find attribute that looks like locked
  const isLocked = (attrs as Record<string, unknown>).isLocked as boolean | undefined ?? (attrs as Record<string, unknown>).locked as boolean | undefined;
  const state = base.state;
  const puedeCancelar = state === 'draft' && isLocked !== true;
  const puedeBorrar = isLocked !== true;

  const billingAttr = (attrs.billing_information as Record<string, unknown> | null | undefined) ?? null;
  const billingProfile = resolveBillingProfile(included, billingAttr);
  return {
    ...base,
    items,
    billingProfile,
    direccion: billingProfile?.address ?? undefined,
    puedeCancelar,
    puedeBorrar,
  };
}

function sameBilling(a: PedidoResumen, b: PedidoResumen): boolean {
  return a.billingKey === b.billingKey;
}
function sameChanged(a: PedidoResumen, b: PedidoResumen): boolean {
  const ca = a.changed ?? a.placed;
  const cb = b.changed ?? b.placed;
  if (!ca || !cb) return false;
  return ca === cb;
}
function agruparPedidos(pedidos: PedidoResumen[]): PedidoAgrupado[] {
  // Agrupar solo si coinciden estrictamente: mismo cartGroup, mismo state, mismo checkoutStep,
  // misma facturación, mismo changed, y números consecutivos
  const byCart = new Map<string, PedidoResumen[]>();
  for (const p of pedidos) {
    const key = p.cartGroupUuid ?? `single:${p.uuid}`;
    const arr = byCart.get(key);
    if (arr) arr.push(p);
    else byCart.set(key, [p]);
  }

  const grupos: PedidoAgrupado[] = [];
  for (const [, arrAll] of byCart) {
    if (arrAll.length === 1) {
      const p = arrAll[0];
      grupos.push({
        uuid: p.uuid,
        orderId: p.orderId,
        orderIds: [p.orderId],
        uuids: [p.uuid],
        state: p.state,
        checkoutStep: p.checkoutStep,
        cartGroupUuid: p.cartGroupUuid,
        placed: p.placed,
        total: p.total,
        pedidos: [p],
        storeLabels: p.storeLabel ? [p.storeLabel] : [],
      });
      continue;
    }
    // Ordenar por orderId para detectar consecutivos
    arrAll.sort((a, b) => a.orderId - b.orderId);
    let current: PedidoResumen[] = [arrAll[0]];
    for (let i = 1; i < arrAll.length; i++) {
      const prev = arrAll[i - 1];
      const cur = arrAll[i];
      const consecutivo = cur.orderId === prev.orderId + 1;
      const mismoEstado = cur.state === prev.state;
      const mismoPaso = (cur.checkoutStep ?? null) === (prev.checkoutStep ?? null);
      const mismaFacturacion = sameBilling(cur, prev);
      const mismoChanged = sameChanged(cur, prev);
      // Solo agrupar si TODO coincide y es consecutivo
      if (consecutivo && mismoEstado && mismoPaso && mismaFacturacion && mismoChanged) {
        current.push(cur);
      } else {
        // Cerrar grupo actual
        const first = current[0];
        const total = current.reduce((s, x) => s + x.total, 0);
        const placed = current.reduce((acc: string | null, x) => {
          if (!x.placed) return acc;
          if (!acc) return x.placed;
          return new Date(x.placed) > new Date(acc) ? x.placed : acc;
        }, first.placed);
        grupos.push({
          uuid: first.uuid,
          orderId: first.orderId,
          orderIds: current.map((x) => x.orderId),
          uuids: current.map((x) => x.uuid),
          state: first.state,
          checkoutStep: first.checkoutStep,
          cartGroupUuid: first.cartGroupUuid,
          placed,
          total,
          pedidos: [...current],
          storeLabels: [...new Set(current.map((x) => x.storeLabel).filter(Boolean) as string[])],
        });
        current = [cur];
      }
    }
    // Último grupo
    if (current.length > 0) {
      const first = current[0];
      const total = current.reduce((s, x) => s + x.total, 0);
      const placed = current.reduce((acc: string | null, x) => {
        if (!x.placed) return acc;
        if (!acc) return x.placed;
        return new Date(x.placed) > new Date(acc) ? x.placed : acc;
      }, first.placed);
      grupos.push({
        uuid: first.uuid,
        orderId: first.orderId,
        orderIds: current.map((x) => x.orderId),
        uuids: current.map((x) => x.uuid),
        state: first.state,
        checkoutStep: first.checkoutStep,
        cartGroupUuid: first.cartGroupUuid,
        placed,
        total,
        pedidos: [...current],
        storeLabels: [...new Set(current.map((x) => x.storeLabel).filter(Boolean) as string[])],
      });
    }
  }
  grupos.sort((a, b) => {
    if (!a.placed || !b.placed) return 0;
    return new Date(b.placed).getTime() - new Date(a.placed).getTime();
  });
  return grupos;
}

export async function listarPedidos(
  tab: PedidoTab,
  auth: PedidoAuth,
  cursor?: string | null,
): Promise<{ pedidos: PedidoResumen[]; nextCursor: string | null; grupos: PedidoAgrupado[] }> {
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
  const grupos = agruparPedidos(pedidos);
  const nextCursor = data.links?.next?.href ?? null;
  return { pedidos, grupos, nextCursor };
}

export async function obtenerPedido(uuid: string, auth: PedidoAuth): Promise<PedidoDetalle> {
  const data = await pedidoFetch<{
    data: Record<string, unknown>;
    included?: Record<string, unknown>[];
  }>(`commerce_order/default/${uuid}?include=billing_profile,order_items.purchased_entity,order_items.purchased_entity.field_imagen,order_items.purchased_entity.field_imagen.field_media_image,store_id`, auth);

  const included = (data.included ?? []) as Record<string, unknown>[];
  return parsePedidoDetalle(data.data as Record<string, unknown>, included);
}

function isSameGroupForDetail(a: PedidoDetalle, b: PedidoDetalle): boolean {
  if (a.cartGroupUuid !== b.cartGroupUuid) return false;
  if (a.state !== b.state) return false;
  if ((a.checkoutStep ?? null) !== (b.checkoutStep ?? null)) return false;
  const aKey = a.billingProfile ? `${a.billingProfile.firstName}|${a.billingProfile.lastName}|${a.billingProfile.phone}|${a.billingProfile.ciPassport}|${a.billingProfile.address?.addressLine1 ?? ''}` : 'null';
  const bKey = b.billingProfile ? `${b.billingProfile.firstName}|${b.billingProfile.lastName}|${b.billingProfile.phone}|${b.billingProfile.ciPassport}|${b.billingProfile.address?.addressLine1 ?? ''}` : 'null';
  if (aKey !== bKey) return false;
  // changed debe ser exactamente igual (misma sesión)
  const aChanged = (a as unknown as { changed?: string }).changed ?? null;
  const bChanged = (b as unknown as { changed?: string }).changed ?? null;
  if (aChanged && bChanged && aChanged !== bChanged) return false;
  if (!aChanged || !bChanged) {
    // fallback a placed si no hay changed
    if (a.placed !== b.placed) return false;
  }
  // Consecutivos: ordenar y check
  return true;
}

export async function obtenerPedidoAgrupado(uuid: string, auth: PedidoAuth): Promise<PedidoDetalle & { hermanos: PedidoDetalle[]; todosItems: PedidoDetalle['items']; storeGroups: Array<{ storeLabel?: string; items: PedidoDetalle['items'] }> }> {
  const base = await obtenerPedido(uuid, auth);
  if (!base.cartGroupUuid) {
    return { ...base, hermanos: [], todosItems: base.items, storeGroups: [{ storeLabel: base.storeLabel, items: base.items }] };
  }
  try {
    const hermanosMeta = await listarPedidosPorCartGroup(base.cartGroupUuid, auth);
    if (hermanosMeta.length <= 1) {
      return { ...base, hermanos: [], todosItems: base.items, storeGroups: [{ storeLabel: base.storeLabel, items: base.items }] };
    }
    // Fetch detalles de cada hermano (incluido el base, pero ya lo tenemos)
    const detalles = await Promise.all(
      hermanosMeta.map(async (h) => {
        if (h.uuid === uuid) return base;
        try {
          return await obtenerPedido(h.uuid, auth);
        } catch {
          return null;
        }
      }),
    );
    let validos = detalles.filter(Boolean) as PedidoDetalle[];
    // Filtrar solo los que realmente pertenecen al mismo grupo estricto que base
    validos = validos.filter((d) => isSameGroupForDetail(base, d));
    // Además, solo mantener consecutivos con base
    validos.sort((a, b) => a.orderId - b.orderId);
    // Si base no está en el medio de consecutivos, recortar
    const baseIdx = validos.findIndex((d) => d.uuid === uuid);
    if (baseIdx !== -1) {
      // Expandir solo consecutivos alrededor de base
      let start = baseIdx;
      let end = baseIdx;
      // hacia atrás
      for (let i = baseIdx - 1; i >= 0; i--) {
        if (validos[i].orderId === validos[i + 1].orderId - 1 && isSameGroupForDetail(validos[i], validos[i + 1])) start = i;
        else break;
      }
      // hacia adelante
      for (let i = baseIdx + 1; i < validos.length; i++) {
        if (validos[i].orderId === validos[i - 1].orderId + 1 && isSameGroupForDetail(validos[i], validos[i - 1])) end = i;
        else break;
      }
      validos = validos.slice(start, end + 1);
    }
    if (validos.length <= 1) {
      return { ...base, hermanos: [], todosItems: base.items, storeGroups: [{ storeLabel: base.storeLabel, items: base.items }] };
    }
    // Agrupar items por storeLabel
    const byStore = new Map<string, PedidoDetalle['items']>();
    for (const det of validos) {
      const key = det.storeLabel ?? `Tienda ${det.orderId}`;
      const arr = byStore.get(key) ?? [];
      arr.push(...det.items);
      byStore.set(key, arr);
    }
    const storeGroups = [...byStore.entries()].map(([storeLabel, items]) => ({ storeLabel, items }));
    const todosItems = validos.flatMap((d) => d.items);
    const total = validos.reduce((s, d) => s + d.total, 0);
    const billing = validos.find((d) => d.billingProfile)?.billingProfile ?? base.billingProfile;
    return {
      ...base,
      total,
      billingProfile: billing,
      direccion: billing?.address ?? base.direccion,
      hermanos: validos.filter((d) => d.uuid !== uuid),
      todosItems,
      storeGroups,
    };
  } catch {
    return { ...base, hermanos: [], todosItems: base.items, storeGroups: [{ storeLabel: base.storeLabel, items: base.items }] };
  }
}

async function pedidoFetchJWTOnly<T = unknown>(path: string, auth: PedidoAuth, init: RequestInit = {}): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/jsonapi/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${auth.accessToken}`,
      'X-Auth-Token': getApiKeyValue() || '',
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

export async function cancelarPedido(uuid: string, auth: PedidoAuth): Promise<void> {
  await pedidoFetchJWTOnly(`commerce_order/default/${uuid}`, auth, {
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
  await pedidoFetchJWTOnly(`commerce_order/default/${uuid}`, auth, { method: 'DELETE' });
}

export async function listarPedidosPorCartGroup(
  cartGroupUuid: string,
  auth: PedidoAuth,
): Promise<PedidoHermano[]> {
  const data = await pedidoFetch<{ data: Record<string, unknown>[] }>(
    `commerce_order/default?filter[field_cart_group_uuid][value]=${encodeURIComponent(cartGroupUuid)}&filter[cart][value]=0`,
    auth,
  );
  const list = Array.isArray(data.data) ? data.data : [];
  return list.map((r) => {
    const attrs = r.attributes as Record<string, unknown>;
    return {
      uuid: r.id as string,
      orderId: (attrs.drupal_internal__order_id as number) ?? 0,
      state: (attrs.state as string) ?? 'draft',
    };
  });
}
