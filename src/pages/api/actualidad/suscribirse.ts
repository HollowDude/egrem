import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { isSubscribed, subscribe } from '@/lib/nodehive/newsletter';
import { isValidLang, DEFAULT_LANG } from '@/i18n';

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
  let blogId: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.lang === 'string') lang = body.lang;
    if (typeof body?.blogId === 'number') blogId = body.blogId;
    else if (typeof body?.blogId === 'string' && body.blogId !== '') blogId = Number(body.blogId);
  } catch {
    // ignore malformed body, default lang
  }
  lang = isValidLang(lang) ? lang : DEFAULT_LANG;

  if (!blogId || !Number.isFinite(blogId)) {
    return new Response(JSON.stringify({ error: 'blogId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const already = await isSubscribed(mail, blogId, lang);
    if (already) {
      return new Response(JSON.stringify({ success: true, already: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await subscribe(mail, blogId, session.accessToken, session.csrfToken, lang);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || 'Could not subscribe.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, already: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/actualidad/suscribirse]', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
