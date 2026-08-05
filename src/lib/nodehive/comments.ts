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
  parentId?: string | null;
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

export async function getComments(nodeUuid: string, lang = 'es'): Promise<NhComment[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `comment/${COMMENT_TYPE}?filter[entity_id.id][value]=${nodeUuid}&sort=created&include=uid,pid`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];

    return data
      .filter((resource) => {
        const a = resource.attributes as Record<string, unknown>;
        const status = a.status as boolean | undefined;
        const aprobado = a.field_aprobado as boolean | undefined;
        return status === true || aprobado === true;
      })
      .map((resource) => {
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

      const pidRel = resource.relationships?.pid;
      const pidData = Array.isArray(pidRel?.data) ? pidRel?.data[0] : pidRel?.data;
      const parentId =
        pidData && typeof pidData === 'object' && 'id' in pidData
          ? (pidData.id as string)
          : null;

      return {
        id: resource.id,
        author: authorName || 'Anónimo',
        authorInitial: (authorName || '?')[0].toUpperCase(),
        body: (bodyValue as string) ?? '',
        created: a.created as string,
        relativeTime: relativeTime(a.created as string, lang),
        status: 'published',
        parentId,
      } satisfies NhComment;
    });
  } catch (e) {
    console.warn('[NodeHive] getComments failed:', e);
    return [];
  }
}
function isPublished(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (Array.isArray(value)) return value.some((v) => isPublished(v?.value ?? v));
  if (value && typeof value === 'object') {
    const v = (value as { value?: unknown }).value;
    if (v !== undefined) return isPublished(v);
  }
  return false;
}

export async function postComment(
  nid: number,
  nodeUuid: string,
  nodeType: string,
  accessToken: string,
  csrfToken: string,
  body: string,
  parentId?: string | null,
): Promise<{ ok: boolean; error?: string; id?: string; status?: 'published' | 'pending' }> {
  const baseUrl = getBaseUrlValue();

  try {
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
            entity_type: 'node',
            field_name: 'field_comentarios',
            comment_body: [{ value: body, format: 'basic_html' }],
          },
          relationships: {
            entity_id: {
              data: { type: nodeType, id: nodeUuid },
            },
            ...(parentId
              ? {
                  pid: {
                    data: { type: 'comment--comment', id: parentId },
                  },
                }
              : {}),
          },
        },
      }),
    });
    if (jsonRes.ok) {
      const json = await jsonRes.json().catch(() => null);
      const id = json?.data?.id ?? '';
      return {
        ok: true,
        id,
        status: isPublished(json?.data?.attributes?.status) ? 'published' : 'pending',
      };
    }

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
        ...(parentId ? { pid: [{ target_uuid: parentId }] } : {}),
      }),
    });
    if (restRes.ok) {
      const json = await restRes.json().catch(() => null);
      const id =
        (typeof json?.uuid === 'string' && json.uuid) ||
        (typeof json?.id === 'string' && json.id) ||
        '';
      return {
        ok: true,
        id,
        status: isPublished(json?.status) ? 'published' : 'pending',
      };
    }

    const text = await restRes.text().catch(() => '');
    console.error('[NodeHive] postComment failed:', jsonRes.status, restRes.status, text);
    return {
      ok: false,
      error: 'No se pudo publicar el comentario. Verifica tu sesión o configuración de Drupal.',
    };
  } catch (e) {
    console.error('[NodeHive] postComment network error:', e);
    return {
      ok: false,
      error: 'No se pudo publicar el comentario. Intenta nuevamente.',
    };
  }
}
