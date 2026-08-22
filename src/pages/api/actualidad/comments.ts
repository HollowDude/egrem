import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getComments, postComment } from '@/lib/nodehive/comments';

export const GET: APIRoute = async ({ url, cookies }) => {
  const nodeUuid = url.searchParams.get('node');
  const lang = url.searchParams.get('lang') || 'es';

  if (!nodeUuid) {
    return new Response(JSON.stringify({ error: 'Missing node param.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await getSession(cookies);
  const comments = await getComments(nodeUuid, lang);

  const visible = comments.filter((c) => {
    if (c.status === 'published') return true;
    return session !== null && c.ownerUid !== null && String(c.ownerUid) === String(session.uid);
  });

  return new Response(JSON.stringify(visible), {
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
    const { nid, nodeUuid, nodeType, body, parentId } = await request.json();

    if (!nid || !body) {
      return new Response(JSON.stringify({ error: 'Missing nid or body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await postComment(
      nid,
      nodeUuid,
      nodeType,
      session.accessToken,
      session.csrfToken,
      body,
      typeof parentId === 'string' && parentId.length > 0 ? parentId : null,
    );

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || 'Could not post comment.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, commentId: result.id, status: result.status }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    console.error('[api/actualidad/comments]', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
