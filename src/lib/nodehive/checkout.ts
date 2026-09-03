/**
 * Checkout multi-paso Egrem — capa de datos.
 *
 * JSON crudo real de GET /es/api/checkout (verificado con cart_group c1c70...):
 * {
 *   "cart_group":"c1c70fcb-5421-4436-a7cf-308b8362fdda",
 *   "orders":[{
 *     "order_id":59,"order_uuid":"24f7528c-145c-4ed8-8cc8-7b3f1364ecb9","order_number":null,
 *     "state":"draft","cart":true,"cart_group":"c1c70...","checkout_flow":"","checkout_step":null,
 *     "store_id":2,"total":25,"currency":"USD","billing_profile":null,
 *     "field_shipping_method":null,"field_payment_method":null,
 *     "items":[{"order_item_id":106,"title":"Libro de Prueba Egrem","quantity":1,"unit_price":25,"sku":"SKU-..."}]
 *   }]
 * }
 * // Tras iniciar checkout: checkout_flow="egrem_front", checkout_step="egrem_billing" etc.
 * // Billing profile serializado como en CheckoutApiController::serializeOrder().
 *
 * Endpoints son controladores custom (no JSON:API), patrón igual a api/cart/*:
 * POST /{lang}/api/checkout/start, GET /{lang}/api/checkout, PATCH /{lang}/api/checkout/{order}/billing etc.
 * Contrato confirmado contra Drupal (egrem_checkout.routing.yml) 2026-09-01.
 */
import { getApiKeyValue, getBaseUrlValue } from './client';

export interface CheckoutAuth {
  accessToken: string;
  csrfToken?: string;
  sessionCookie?: string;
  lang?: 'es' | 'en';
}

export type ShippingMethod = 'pickup' | 'standard' | 'express';
export type PaymentMethodValue = 'efectivo' | 'transfermovil';
export type CheckoutStep = 'egrem_billing' | 'egrem_shipping' | 'egrem_payment_method' | 'egrem_payment' | 'complete';

export class CheckoutApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `checkout_error_${status}`);
  }
}

export interface TransfermovilOrderRef {
  orderId: number;
  storeLabel: string;
}

export interface TransfermovilQR {
  cartGroup: string;
  total: number;
  currency: string;
  url: string;
  qr: string;
  qrText: string;
  orders: TransfermovilOrderRef[];
  cached: boolean;
}

export interface TransfermovilStatusOrder {
  orderId: number;
  paid: boolean;
  state: string;
}

export interface TransfermovilStatus {
  paid: boolean;
  orders: TransfermovilStatusOrder[];
  cartGroup: string;
}

export interface PlaceErrorItem {
  orderId?: number;
  message: string;
}

export interface PlaceResult {
  placed: number[];
  errors: PlaceErrorItem[];
  orders: Array<{ orderId: number; state: string; storeLabel?: string; total?: number }>;
  cartGroup?: string;
}

export interface CheckoutOrderRef {
  orderId: number;
  checkoutStep: CheckoutStep | null;
  cart: boolean;
}

export interface CheckoutStartResult {
  cartGroup: string;
  orders: CheckoutOrderRef[];
}

export interface CheckoutAddress {
  countryCode: string;
  administrativeArea: string;
  locality: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
}

export interface CheckoutBillingProfile {
  profileId: string;
  profileUuid: string;
  firstName: string;
  lastName: string;
  phone: string;
  ciPassport: string;
  address: CheckoutAddress | null;
}

export interface CheckoutLineItem {
  orderItemId?: number;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
}

export interface CheckoutOrderDetail {
  orderId: number;
  orderUuid: string;
  orderNumber: string | null;
  state: string;
  cart: boolean;
  cartGroup: string | null;
  checkoutFlow: string;
  checkoutStep: CheckoutStep | null;
  storeId: number | string;
  total: number;
  currency: string | null;
  billingProfile: CheckoutBillingProfile | null;
  shippingMethod: ShippingMethod | null;
  paymentMethod: PaymentMethodValue | null;
  items: CheckoutLineItem[];
}

export interface BillingInlinePayload {
  countryCode: string;
  administrativeArea: string;
  locality: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  firstName: string;
  lastName: string;
  phone: string;
  ciPassport: string;
  isDefault?: boolean;
}

function sessionCookieHeader(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function checkoutApiFetch<T = unknown>(
  path: string,
  auth: CheckoutAuth,
  init: RequestInit = {},
): Promise<T> {
  const base = getBaseUrlValue().replace(/\/$/, '');
  const lang = auth.lang ?? 'es';
  const url = `${base}/${lang}/${path}`;
  const isWrite = init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase());
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.accessToken}`,
      'X-Auth-Token': getApiKeyValue() || '',
      ...(auth.sessionCookie ? { Cookie: sessionCookieHeader(auth.sessionCookie)! } : {}),
      ...(isWrite && auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    throw new CheckoutApiError(res.status, body, `Checkout request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ---- parsers defensivos ----
function parseBillingProfile(raw: unknown): CheckoutBillingProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const addr = r.address as Record<string, unknown> | null | undefined;
  let phone: string = '';
  const phoneRaw = r.field_phone as unknown;
  if (typeof phoneRaw === 'string') phone = phoneRaw;
  else if (phoneRaw && typeof phoneRaw === 'object') phone = (phoneRaw as Record<string, unknown>).phone_number as string ?? '';
  return {
    profileId: String(r.profile_id ?? ''),
    profileUuid: String(r.profile_uuid ?? ''),
    firstName: String(r.field_first_name ?? ''),
    lastName: String(r.field_last_name ?? ''),
    phone,
    ciPassport: String(r.field_ci_passport ?? ''),
    address: addr
      ? {
          countryCode: String(addr.country_code ?? 'CU'),
          administrativeArea: String(addr.administrative_area ?? ''),
          locality: String(addr.locality ?? ''),
          addressLine1: String(addr.address_line1 ?? ''),
          addressLine2: addr.address_line2 ? String(addr.address_line2) : undefined,
          postalCode: addr.postal_code ? String(addr.postal_code) : undefined,
        }
      : null,
  };
}

function parseOrder(raw: Record<string, unknown>): CheckoutOrderDetail {
  return {
    orderId: Number(raw.order_id),
    orderUuid: String(raw.order_uuid ?? ''),
    orderNumber: raw.order_number ? String(raw.order_number) : null,
    state: String(raw.state ?? ''),
    cart: Boolean(raw.cart),
    cartGroup: raw.cart_group ? String(raw.cart_group) : null,
    checkoutFlow: String(raw.checkout_flow ?? ''),
    checkoutStep: (raw.checkout_step as CheckoutStep) ?? null,
    storeId: (raw.store_id as number | string) ?? '',
    total: Number(raw.total ?? 0),
    currency: raw.currency ? String(raw.currency) : null,
    billingProfile: parseBillingProfile(raw.billing_profile),
    shippingMethod: (raw.field_shipping_method as ShippingMethod) ?? null,
    paymentMethod: (raw.field_payment_method as PaymentMethodValue) ?? null,
    items: Array.isArray(raw.items)
      ? (raw.items as Record<string, unknown>[]).map((it) => ({
          orderItemId: it.order_item_id != null ? Number(it.order_item_id) : undefined,
          sku: String(it.sku ?? ''),
          title: String(it.title ?? ''),
          quantity: Number(it.quantity ?? 0),
          unitPrice: it.unit_price != null ? Number(it.unit_price) : null,
        }))
      : [],
  };
}

// ---- API ----

export async function iniciarCheckout(cartGroup: string, auth: CheckoutAuth): Promise<CheckoutStartResult> {
  const data = await checkoutApiFetch<{ cart_group: string; orders: Record<string, unknown>[] | Record<string, Record<string, unknown>> }>(
    'api/checkout/start',
    auth,
    { method: 'POST', body: JSON.stringify({ cart_group: cartGroup }) },
  );
  const rawOrders = data.orders as unknown;
  const ordersArray: Record<string, unknown>[] = Array.isArray(rawOrders)
    ? (rawOrders as Record<string, unknown>[])
    : rawOrders && typeof rawOrders === 'object'
      ? Object.values(rawOrders as Record<string, Record<string, unknown>>)
      : [];
  const orders: CheckoutOrderRef[] = ordersArray.map((o) => ({
    orderId: Number(o.order_id),
    checkoutStep: (o.checkout_step as CheckoutStep) ?? null,
    cart: Boolean(o.cart),
  }));
  return { cartGroup: String(data.cart_group), orders };
}

export async function obtenerCheckout(
  params: { orderId?: number | string; cartGroup?: string },
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  let path = 'api/checkout';
  if (params.orderId) path += `?order_id=${encodeURIComponent(String(params.orderId))}`;
  else if (params.cartGroup) path += `?cart_group=${encodeURIComponent(String(params.cartGroup))}`;
  const data = await checkoutApiFetch<Record<string, unknown>>(path, auth);
  // Formas posibles: {order: {...}} | {orders:[...]} | orden plano
  if (data.order && typeof data.order === 'object') return parseOrder(data.order as Record<string, unknown>);
  if (Array.isArray(data.orders) && data.orders.length > 0) return parseOrder(data.orders[0] as Record<string, unknown>);
  if (data.order_id != null) return parseOrder(data as Record<string, unknown>);
  // Fallback: si viene {orders:[]} vacío, error
  throw new Error('Checkout order not found in response');
}

export async function obtenerCheckoutsPorGrupo(
  cartGroup: string,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail[]> {
  const data = await checkoutApiFetch<{ cart_group: string; orders: Record<string, unknown>[] }>(
    `api/checkout?cart_group=${encodeURIComponent(cartGroup)}`,
    auth,
  );
  return (data.orders ?? []).map((o) => parseOrder(o as Record<string, unknown>));
}

export async function guardarFacturacionConPerfil(
  orderId: number | string,
  profileId: string,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  const data = await checkoutApiFetch<{ order: Record<string, unknown> }>(
    `api/checkout/${orderId}/billing`,
    auth,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId }) },
  );
  return parseOrder(data.order);
}

export async function guardarFacturacionInline(
  orderId: number | string,
  payload: BillingInlinePayload,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  // Backend acepta tanto address anidado como campos sueltos; mandamos ambos para compat
  const body: Record<string, unknown> = {
    address: {
      country_code: payload.countryCode || 'CU',
      administrative_area: payload.administrativeArea,
      locality: payload.locality,
      address_line1: payload.addressLine1,
      address_line2: payload.addressLine2 ?? '',
      postal_code: payload.postalCode ?? '',
      given_name: payload.firstName,
      family_name: payload.lastName,
    },
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    ciPassport: payload.ciPassport,
    // también snake_case por si el backend lo espera
    field_first_name: payload.firstName,
    field_last_name: payload.lastName,
    field_phone: payload.phone,
    field_ci_passport: payload.ciPassport,
    countryCode: payload.countryCode,
    administrativeArea: payload.administrativeArea,
    locality: payload.locality,
    addressLine1: payload.addressLine1,
    ...(payload.isDefault !== undefined ? { is_default: payload.isDefault, isDefault: payload.isDefault } : {}),
  };
  const data = await checkoutApiFetch<{ order: Record<string, unknown> }>(
    `api/checkout/${orderId}/billing`,
    auth,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  return parseOrder(data.order);
}

export async function guardarEnvio(
  orderId: number | string,
  method: ShippingMethod,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  const data = await checkoutApiFetch<{ order: Record<string, unknown> }>(
    `api/checkout/${orderId}/shipping`,
    auth,
    { method: 'PATCH', body: JSON.stringify({ shipping_method: method }) },
  );
  return parseOrder(data.order);
}

export async function guardarMetodoPago(
  orderId: number | string,
  method: PaymentMethodValue,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  const data = await checkoutApiFetch<{ order: Record<string, unknown> }>(
    `api/checkout/${orderId}/payment-method`,
    auth,
    { method: 'PATCH', body: JSON.stringify({ payment_method: method }) },
  );
  return parseOrder(data.order);
}

export async function cambiarPaso(
  orderId: number | string,
  step: CheckoutStep,
  auth: CheckoutAuth,
): Promise<CheckoutOrderDetail> {
  const data = await checkoutApiFetch<{ order: Record<string, unknown> }>(
    `api/checkout/${orderId}/step`,
    auth,
    { method: 'PATCH', body: JSON.stringify({ checkout_step: step }) },
  );
  return parseOrder(data.order);
}

export async function crearQRTransfermovil(cartGroup: string, auth: CheckoutAuth): Promise<TransfermovilQR> {
  const data = await checkoutApiFetch<Record<string, unknown>>(`api/checkout/group/${cartGroup}/transfermovil/create`, auth, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const ordersRaw = (data.orders as unknown as Array<Record<string, unknown>>) ?? [];
  return {
    cartGroup: String(data.cart_group ?? cartGroup),
    total: Number(data.total ?? 0),
    currency: String(data.currency ?? 'CUP'),
    url: String(data.url ?? ''),
    qr: String(data.qr ?? data.qr_text ?? ''),
    qrText: String((data.qr_text as string) ?? data.qr ?? ''),
    orders: ordersRaw.map((o) => ({ orderId: Number(o.order_id), storeLabel: String(o.store_label ?? '') })),
    cached: Boolean(data.cached),
  };
}

export async function consultarEstadoTransfermovil(cartGroup: string, auth: CheckoutAuth): Promise<TransfermovilStatus> {
  const data = await checkoutApiFetch<Record<string, unknown>>(`api/checkout/group/${cartGroup}/transfermovil/status`, auth);
  const orders = Array.isArray(data.orders) ? (data.orders as Record<string, unknown>[]).map((o) => ({ orderId: Number(o.order_id), paid: Boolean(o.paid), state: String(o.state ?? '') })) : [];
  return {
    cartGroup: String(data.cart_group ?? cartGroup),
    paid: Boolean(data.paid),
    orders,
  };
}

export async function confirmarPedido(cartGroup: string, auth: CheckoutAuth): Promise<PlaceResult> {
  const data = await checkoutApiFetch<Record<string, unknown>>('api/checkout/place', auth, {
    method: 'POST',
    body: JSON.stringify({ cart_group: cartGroup }),
  });
  const placed = Array.isArray(data.placed) ? (data.placed as number[]).map(Number) : [];
  const errors: PlaceErrorItem[] = Array.isArray(data.errors)
    ? (data.errors as Record<string, unknown>[]).map((e) => ({ orderId: e.order_id != null ? Number(e.order_id) : undefined, message: String(e.error ?? e.message ?? '') }))
    : [];
  const orders = Array.isArray(data.orders)
    ? (data.orders as Record<string, unknown>[]).map((o) => ({ orderId: Number(o.order_id), state: String(o.state ?? ''), storeLabel: o.store_label ? String(o.store_label) : undefined, total: o.total != null ? Number(o.total) : undefined }))
    : [];
  return { placed, errors, orders, cartGroup: data.cart_group ? String(data.cart_group) : undefined };
}

export function mensajeErrorCheckout(status: number): string {
  switch (status) {
    case 422:
      return 'Faltan datos previos (facturación, envío o método de pago). Vuelve a revisar los pasos anteriores.';
    case 400:
      return 'No hay pedidos activos en tu carrito.';
    case 404:
      return 'No se encontró tu grupo de compra. Vuelve a intentar desde el carrito.';
    case 500:
    case 502:
      return 'El pago con Transfermóvil no está disponible en este momento. Prueba con Efectivo.';
    default:
      return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }
}
