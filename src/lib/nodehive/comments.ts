import { jsonApiFetch, getBaseUrlValue } from './client';

const COMMENT_TYPE = 'comment';

export interface NhComment {
  id: string;
  author: string;
  authorInitial: string;
  body: string;
  created: string;
  relativeTime: string;
  status: 'published' | 'pending';
}

function relativeTime(dateStr: string, lang: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return lang === 'en' ? 'just now' : 'ahora mismo';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'en' ? `${m} min ago` : `hace ${m} min`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === 'en' ? `${h}h ago` : `hace ${h}h`;
  }
  const d = Math.floor(diff / 86400);
  return lang === 'en' ? `${d}d ago` : `hace ${d}d`;
}

function mapResource(
  resource: JsonApiResource,
  included: JsonApiResource[],
  lang: string,
  status: 'published' | 'pending',
): NhComment {
  const a = resource.attributes as Record<string, unknown>;
  const bodyField = a.comment_body as { value?: string } | { value?: string }[] | undefined;
  const bodyValue = Array.isArray(bodyField)
    ? bodyField[0]?.value
    : (bodyField as { value?: string } | undefined)?.value;

  const uidRel = resource.relationships?.uid;
  const uidData = Array.isArray(uidRel?.data) ? uidRel?.data[0] : uidRel?.data;
  let authorName = (a.name as string) ?? '';
  if (uidData && typeof uidData === 'object' && 'id' in uidData) {
    const user = included.find((r) => r.type === 'user--user' && r.id === uidData.id);
    if (user) {
      const ua = user.attributes as Record<string, unknown>;
      authorName = (ua.display_name as string) ?? (ua.name as string) ?? '';
    }
  }

  return {
    id: resource.id,
    author: authorName || 'Anónimo',
    authorInitial: (authorName || '?')[0].toUpperCase(),
    body: (bodyValue as string) ?? '',
    created: a.created as string,
    relativeTime: relativeTime(a.created as string, lang),
    status,
  };
}

async function fetchCommentsByFilter(
  filter: string,
  lang: string,
  accessToken?: string,
): Promise<{ resources: JsonApiResource[]; included: JsonApiResource[] }> {
  const path = `comment/${COMMENT_TYPE}?${filter}&sort=created&include=uid`;

  if (accessToken) {
    const url = `${getBaseUrlValue()}/${lang}/jsonapi/${path}`
      .replace(/\[/g, '%5B')
      .replace(/\]/g, '%5D');
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return { resources: [], included: [] };
    const json: JsonApiResponse = await res.json();
    const resources = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
    return { resources, included: json.included ?? [] };
  }

  const res = await jsonApiFetch<Record<string, unknown>>(path, lang).catch(() => null);
  if (!res) return { resources: [], included: [] };
  const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
  return { resources: data as JsonApiResource[], included: (res.included ?? []) as JsonApiResource[] };
}

export async function getComments(
  nodeUuid: string,
  lang = 'es',
  options?: { uid?: string; accessToken?: string },
): Promise<NhComment[]> {
  try {
    const published = await fetchCommentsByFilter(
      `filter[entity_id.id][value]=${nodeUuid}&filter[status][value]=1`,
      lang,
    );

    const all: NhComment[] = published.resources.map((r) =>
      mapResource(r, published.included, lang, 'published'),
    );

    if (options?.uid && options?.accessToken) {
      const pending = await fetchCommentsByFilter(
        `filter[entity_id.id][value]=${nodeUuid}&filter[uid.id][value]=${options.uid}&filter[status][value]=0`,
        lang,
        options.accessToken,
      );
      for (const r of pending.resources) {
        if (!all.some((c) => c.id === r.id)) {
          all.push(mapResource(r, pending.included, lang, 'pending'));
        }
      }
    }

    all.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
    return all;
  } catch (e) {
    console.warn('[NodeHive] getComments failed:', e);
    return [];
  }
}

export async function postComment(
  nid: number,
  accessToken: string,
  csrfToken: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getBaseUrlValue();

  // Try JSON:API with Bearer token first
  const jsonRes = await fetch(`${baseUrl}/jsonapi/comment/comment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'comment--comment',
        attributes: {
          entity_id: nid,
          entity_type: 'node',
          field_name: 'field_comentarios',
          comment_body: [{ value: body, format: 'basic_html' }],
        },
      },
    }),
  });
  if (jsonRes.ok) return { ok: true };

  // Fallback: REST format with lang prefix + csrf_token
  const restRes = await fetch(`${baseUrl}/es/comment?_format=json`, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      entity_id: [{ target_id: nid }],
      entity_type: [{ value: 'node' }],
      comment_type: [{ target_id: COMMENT_TYPE }],
      field_name: [{ value: 'field_comentarios' }],
      subject: [{ value: '' }],
      comment_body: [{ value: body, format: 'basic_html' }],
    }),
  });
  if (restRes.ok) return { ok: true };

  const text = await restRes.text().catch(() => '');
  console.error('[NodeHive] postComment failed:', jsonRes.status, restRes.status, text);
  return {
    ok: false,
    error: 'No se pudo publicar el comentario. Verifica tu sesión o configuración de Drupal.',
  };
}
