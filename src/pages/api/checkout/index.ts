import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { obtenerCheckout, obtenerCheckoutsPorGrupo } from '@/lib/nodehive/checkout';

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const orderId = url.searchParams.get('order_id');
  if (orderId) {
    try {
      const order = await obtenerCheckout({ orderId }, { accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie });
      return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('[api/checkout GET order_id]', e);
      return new Response(JSON.stringify({ error: 'No se pudo obtener el pedido.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  const raw = cookies.get('egrem_checkout_orders')?.value;
  let orderIds: number[] = [];
  let cartGroup: string | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      orderIds = parsed.orderIds ?? [];
      cartGroup = parsed.cartGroup;
    } catch {}
  }
  if (orderIds.length > 0) {
    try {
      const order = await obtenerCheckout({ orderId: orderIds[0] }, { accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie });
      return new Response(JSON.stringify({ order, cartGroup, orderIds }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('[api/checkout GET cookie]', e);
    }
  }
  // Fallback: intentar por cartGroup
  if (cartGroup) {
    try {
      const orders = await obtenerCheckoutsPorGrupo(cartGroup, { accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie });
      if (orders.length > 0) return new Response(JSON.stringify({ order: orders[0], cartGroup, orderIds: orders.map((o) => o.orderId) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch {}
  }
  return new Response(JSON.stringify({ error: 'No hay checkout activo.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
};
