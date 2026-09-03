import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { listarPedidos } from '@/lib/nodehive/pedidos';
import type { PedidoTab } from '@/lib/nodehive/pedidos';

export const GET: APIRoute = async ({ url, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tabParam = url.searchParams.get('tab') ?? 'realizados';
  const tab: PedidoTab = tabParam === 'en_proceso' ? 'en_proceso' : tabParam === 'cancelados' ? 'cancelados' : 'realizados';
  const cursor = url.searchParams.get('cursor');

  try {
    const result = await listarPedidos(tab, {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
      lang: (url.searchParams.get('lang') as 'es' | 'en') ?? 'es',
    }, cursor);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/pedidos GET]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('401') || msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo cargar pedidos.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
