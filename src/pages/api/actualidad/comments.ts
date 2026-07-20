import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getComments, postComment } from '@/lib/nodehive/comments';

export const GET: APIRoute = async ({ url }) => {
  const nodeUuid = url.searchParams.get('node');
  const lang = url.searchParams.get('lang') || 'es';

  if (!nodeUuid) {
    return new Response(JSON.stringify({ error: 'Missing node param.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const comments = await getComments(nodeUuid, lang);
  return new Response(JSON.stringify(comments), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { nid, body } = await request.json();

    if (!nid || !body) {
      return new Response(JSON.stringify({ error: 'Missing nid or body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await postComment(nid, session.accessToken, session.csrfToken, body);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || 'Could not post comment.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/actualidad/comments]', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
