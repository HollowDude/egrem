import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { obtenerPedido, listarPedidosPorCartGroup } from '@/lib/nodehive/pedidos';
import { CART_GROUP_COOKIE_MAX_AGE } from '@/lib/nodehive/carrito';

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  let body: { uuid?: string };
  try {
    body = (await request.json()) as { uuid?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const uuid = body.uuid?.trim();
  if (!uuid) return new Response(JSON.stringify({ error: 'Falta uuid.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const auth = {
    uid: session.uid,
    accessToken: session.accessToken,
    csrfToken: session.csrfToken,
    sessionCookie: session.sessionCookie,
  };

  try {
    const pedido = await obtenerPedido(uuid, auth);
    if (pedido.state !== 'draft') {
      return new Response(JSON.stringify({ error: 'Este pedido ya no admite continuar el pago.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    let orderIds: number[] = [pedido.orderId];
    let cartGroup: string | null = pedido.cartGroupUuid ?? null;

    if (pedido.cartGroupUuid) {
      try {
        const hermanos = await listarPedidosPorCartGroup(pedido.cartGroupUuid, auth);
        const draftIds = hermanos.filter((h) => h.state === 'draft').map((h) => h.orderId);
        if (draftIds.length > 0) {
          orderIds = [pedido.orderId, ...draftIds.filter((id) => id !== pedido.orderId)];
          cartGroup = pedido.cartGroupUuid;
        }
      } catch {}
    }

    cookies.set('egrem_checkout_orders', JSON.stringify({ cartGroup, orderIds }), {
      path: '/',
      maxAge: CART_GROUP_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/resume]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('404')) return new Response(JSON.stringify({ error: 'Pedido no encontrado.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'No se pudo continuar el pedido.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
