import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { unsubscribe } from '@/lib/nodehive/newsletter';

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mail = session.mail?.trim();
  if (!mail) {
    return new Response(JSON.stringify({ error: 'User email not available.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let lang = 'es';
  try {
    const body = await request.json();
    if (typeof body?.lang === 'string') lang = body.lang;
  } catch {
    // ignore malformed body, default lang
  }

  try {
    const result = await unsubscribe(mail, session.accessToken, session.csrfToken, lang);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || 'Could not unsubscribe.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/actualidad/darse-de-baja]', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
