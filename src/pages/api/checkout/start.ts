import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { iniciarCheckout } from '@/lib/nodehive/checkout';
import { CART_GROUP_COOKIE_MAX_AGE } from '@/lib/nodehive/carrito';

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autenticado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const cartGroup = cookies.get('egrem_cart_group')?.value;
  if (!cartGroup) {
    return new Response(JSON.stringify({ error: 'no_cart' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const result = await iniciarCheckout(cartGroup, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    cookies.set('egrem_checkout_orders', JSON.stringify({ cartGroup: result.cartGroup, orderIds: result.orders.map((o) => o.orderId) }), {
      httpOnly: true,
      path: '/',
      maxAge: CART_GROUP_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    cookies.delete('egrem_cart_group', { path: '/' });
    return new Response(JSON.stringify({ ok: true, cartGroup: result.cartGroup, orders: result.orders }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/checkout/start]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('401')) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'No se pudo iniciar el checkout.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
