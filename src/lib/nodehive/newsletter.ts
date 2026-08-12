import { jsonApiFetch, getBaseUrlValue } from './client';

const NODE_TYPE = 'suscripcion_boletin';
const MAIL_FIELD = 'field_correo_electronico';

export async function isSubscribed(mail: string, lang = 'es'): Promise<boolean> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/${NODE_TYPE}?filter[${MAIL_FIELD}][value]=${encodeURIComponent(mail)}&page[limit]=1`,
      lang,
    );
    return Array.isArray(res.data) ? res.data.length > 0 : Boolean(res.data);
  } catch (e) {
    console.warn('[NodeHive] isSubscribed failed:', e);
    return false;
  }
}

export async function subscribe(
  mail: string,
  accessToken: string,
  csrfToken: string,
  lang = 'es',
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getBaseUrlValue();

  // Try JSON:API with Bearer token first
  let jsonRes: Response;
  try {
    jsonRes = await fetch(`${baseUrl}/${lang}/jsonapi/node/${NODE_TYPE}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: `node--${NODE_TYPE}`,
          attributes: {
            title: mail,
            field_correo_electronico: mail,
          },
        },
      }),
    });
  } catch (e) {
    console.warn('[NodeHive] subscribe jsonapi failed:', e);
    jsonRes = { ok: false, status: 0 } as Response;
  }
  if (jsonRes.ok) return { ok: true };

  // Fallback: REST format with lang prefix + csrf_token
  let restRes: Response;
  try {
    restRes = await fetch(`${baseUrl}/${lang}/node?_format=json`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        type: [{ target_id: NODE_TYPE }],
        title: [{ value: mail }],
        status: [{ value: 1 }],
        field_correo_electronico: [{ value: mail }],
      }),
    });
  } catch (e) {
    console.warn('[NodeHive] subscribe rest failed:', e);
    restRes = { ok: false, status: 0 } as Response;
  }
  if (restRes.ok) return { ok: true };

  const text = typeof restRes.text === 'function' ? await restRes.text().catch(() => '') : '';
  console.error('[NodeHive] subscribe failed:', jsonRes.status, restRes.status, text);
  return {
    ok: false,
    error: 'No se pudo guardar la suscripción. Verifica tu sesión o configuración de Drupal.',
  };
}

export async function unsubscribe(
  mail: string,
  accessToken: string,
  csrfToken: string,
  lang = 'es',
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getBaseUrlValue();

  let listRes: Awaited<ReturnType<typeof jsonApiFetch>>;
  try {
    listRes = await jsonApiFetch<{ data: { id: string }[] }>(
      `node/${NODE_TYPE}?filter[${MAIL_FIELD}][value]=${encodeURIComponent(mail)}&page[limit]=1`,
      lang,
    );
  } catch (e) {
    console.warn('[NodeHive] unsubscribe lookup failed:', e);
    return { ok: false, error: 'No se pudo verificar la suscripción.' };
  }

  const nodes = Array.isArray(listRes.data) ? listRes.data : [];
  if (nodes.length === 0) return { ok: true };

  const uuid = nodes[0].id;
  const res = await fetch(`${baseUrl}/${lang}/jsonapi/node/${NODE_TYPE}/${uuid}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.api+json',
    },
  }).catch(() => ({ ok: false, status: 0 } as Response));

  if (res.ok) return { ok: true };
  return { ok: false, error: 'No se pudo dar de baja la suscripción.' };
}
