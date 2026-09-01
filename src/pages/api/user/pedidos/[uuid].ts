import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { obtenerPedido, cancelarPedido, borrarPedido } from '@/lib/nodehive/pedidos';

export const GET: APIRoute = async ({ params, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uuid = params.uuid as string;
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const pedido = await obtenerPedido(uuid, {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify(pedido), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/pedidos GET uuid]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo cargar el pedido.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uuid = params.uuid as string;
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== 'cancel') {
      return new Response(JSON.stringify({ error: 'Acción no soportada.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await cancelarPedido(uuid, {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/pedidos PATCH]', e);
    const msg = String((e as Error)?.message ?? '');
    // Si Drupal responde 403 por isLocked, devolvemos 409 con mensaje claro
    if (msg.includes('403') || msg.includes('422')) {
      return new Response(JSON.stringify({ error: 'Este pedido no se puede cancelar.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const detail = (msg.match(/detail[^"]*"([^"]+)"/)?.[1] as string | undefined) ?? undefined;
    return new Response(JSON.stringify({ error: detail || 'No se pudo cancelar el pedido.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uuid = params.uuid as string;
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await borrarPedido(uuid, {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('[api/user/pedidos DELETE]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'Este pedido no se puede eliminar.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo eliminar el pedido.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
