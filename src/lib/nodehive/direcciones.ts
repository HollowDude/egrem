import { getApiKeyValue, getBaseUrlValue } from './client';

export interface DireccionAuth {
  uid: string;
  accessToken: string;
  csrfToken: string;
  sessionCookie: string;
  lang?: 'es' | 'en';
}

export interface Direccion {
  uuid: string;
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
}

function sessionCookieHeader(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function profileFetch<T = unknown>(
  path: string,
  auth: DireccionAuth,
  init: RequestInit = {},
): Promise<T> {
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
    throw new Error(`Profile request failed: ${res.status} ${res.statusText} — ${url} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => '');
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function parseDireccionResource(resource: {
  id: string;
  attributes: Record<string, unknown>;
}): Direccion | null {
  const raw = resource.attributes?.address as Record<string, unknown> | undefined;
  if (!raw) return null;
  const phoneRaw = resource.attributes.field_phone as
    | string
    | { phone_number?: string; country_iso2?: string }
    | null
    | undefined;
  const phone =
    typeof phoneRaw === 'string'
      ? phoneRaw
      : typeof phoneRaw === 'object' && phoneRaw !== null
        ? (phoneRaw.phone_number as string) ?? ''
        : '';
  return {
    uuid: resource.id,
    countryCode: (raw.country_code as string) ?? 'CU',
    administrativeArea: (raw.administrative_area as string) ?? '',
    locality: (raw.locality as string) ?? '',
    addressLine1: (raw.address_line1 as string) ?? '',
    addressLine2: (raw.address_line2 as string) ?? '',
    postalCode: (raw.postal_code as string) ?? '',
    firstName: (resource.attributes.field_first_name as string) ?? '',
    lastName: (resource.attributes.field_last_name as string) ?? '',
    phone,
    ciPassport: (resource.attributes.field_ci_passport as string) ?? '',
  };
}

function toPhonePayload(phone: string): Record<string, string> | string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  // Drupal phonenumber field espera objeto { phone_number, country_iso2 }
  // country_iso2 es obligatorio para evitar bug del validador t('Unknown')
  return { phone_number: trimmed, country_iso2: 'CU' };
}

async function getUserUuid(auth: DireccionAuth): Promise<string | null> {
  try {
    const data = await profileFetch<{ data: Array<{ id: string }> }>(
      `user/user?filter[drupal_internal__uid]=${auth.uid}`,
      auth,
    );
    const list = Array.isArray(data.data) ? data.data : [];
    return list[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function listarDirecciones(auth: DireccionAuth): Promise<Direccion[]> {
  // Sin filtro por uid: el endpoint ya devuelve solo los profiles del usuario autenticado
  const data = await profileFetch<{
    data: Array<{ id: string; attributes: Record<string, unknown> }>;
  }>(`profile/customer`, auth);

  const list = Array.isArray(data.data) ? data.data : [];
  const result: Direccion[] = [];
  for (const r of list) {
    const parsed = parseDireccionResource(r as never);
    if (parsed) result.push(parsed);
  }
  return result;
}

export async function crearDireccion(
  data: Omit<Direccion, 'uuid'>,
  auth: DireccionAuth,
): Promise<Direccion> {
  // No enviamos relationships.uid con el ID numérico (causa 404 "user--user:8").
  // Drupal asigna el owner automáticamente al usuario autenticado cuando no se envía,
  // o si se requiere, se resuelve el UUID del usuario.
  const userUuid = await getUserUuid(auth);
  // given_name y family_name son obligatorios en el address de Drupal
  const body: Record<string, unknown> = {
    data: {
      type: 'profile--customer',
      attributes: {
        address: {
          country_code: data.countryCode || 'CU',
          administrative_area: data.administrativeArea,
          locality: data.locality,
          address_line1: data.addressLine1,
          address_line2: data.addressLine2 ?? '',
          postal_code: data.postalCode ?? '',
          given_name: data.firstName || 'Cliente',
          family_name: data.lastName || 'EGREM',
          organization: '',
        },
        field_first_name: data.firstName || '',
        field_last_name: data.lastName || '',
        field_phone: toPhonePayload(data.phone || ''),
        field_ci_passport: data.ciPassport || '',
      },
      ...(userUuid
        ? { relationships: { uid: { data: { type: 'user--user', id: userUuid } } } }
        : {}),
    },
  };

  const res = await profileFetch<{ data: { id: string; attributes: Record<string, unknown> } }>(
    'profile/customer',
    auth,
    { method: 'POST', body: JSON.stringify(body) },
  );
  const parsed = parseDireccionResource(res.data as never);
  if (!parsed) throw new Error('No se pudo parsear la dirección creada');
  return parsed;
}

export async function actualizarDireccion(
  uuid: string,
  data: Partial<Omit<Direccion, 'uuid'>>,
  auth: DireccionAuth,
): Promise<Direccion> {
  const hasAddressField =
    data.countryCode !== undefined ||
    data.administrativeArea !== undefined ||
    data.locality !== undefined ||
    data.addressLine1 !== undefined ||
    data.addressLine2 !== undefined ||
    data.postalCode !== undefined ||
    data.firstName !== undefined ||
    data.lastName !== undefined;

  let addressPatch: Record<string, unknown> | null = null;
  if (hasAddressField) {
    // Para PATCH parcial, necesitamos la dirección actual para no enviar un objeto incompleto
    let current: Direccion | null = null;
    try {
      const res = await profileFetch<{ data: { id: string; attributes: Record<string, unknown> } }>(
        `profile/customer/${uuid}`,
        auth,
      );
      current = parseDireccionResource(res.data as never);
    } catch {
      // Si no se puede obtener, usar payload mínimo
    }
    addressPatch = {
      country_code: data.countryCode !== undefined ? data.countryCode : (current?.countryCode ?? 'CU'),
      administrative_area: data.administrativeArea !== undefined ? data.administrativeArea : (current?.administrativeArea ?? ''),
      locality: data.locality !== undefined ? data.locality : (current?.locality ?? ''),
      address_line1: data.addressLine1 !== undefined ? data.addressLine1 : (current?.addressLine1 ?? ''),
      address_line2: data.addressLine2 !== undefined ? data.addressLine2 : (current?.addressLine2 ?? ''),
      postal_code: data.postalCode !== undefined ? data.postalCode : (current?.postalCode ?? ''),
      given_name: data.firstName !== undefined ? (data.firstName || 'Cliente') : (current?.firstName || 'Cliente'),
      family_name: data.lastName !== undefined ? (data.lastName || 'EGREM') : (current?.lastName || 'EGREM'),
      organization: '',
    };
  }

  const attributesPatch: Record<string, unknown> = {};
  if (addressPatch) attributesPatch.address = addressPatch;
  if (data.firstName !== undefined) attributesPatch.field_first_name = data.firstName;
  if (data.lastName !== undefined) attributesPatch.field_last_name = data.lastName;
  if (data.phone !== undefined) attributesPatch.field_phone = toPhonePayload(data.phone);
  if (data.ciPassport !== undefined) attributesPatch.field_ci_passport = data.ciPassport;

  const body = {
    data: {
      type: 'profile--customer',
      id: uuid,
      attributes: attributesPatch,
    },
  };

  const res = await profileFetch<{ data: { id: string; attributes: Record<string, unknown> } }>(
    `profile/customer/${uuid}`,
    auth,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  const parsed = parseDireccionResource(res.data as never);
  if (!parsed) throw new Error('No se pudo parsear la dirección actualizada');
  return parsed;
}

export async function borrarDireccion(uuid: string, auth: DireccionAuth): Promise<void> {
  await profileFetch(`profile/customer/${uuid}`, auth, { method: 'DELETE' });
}
