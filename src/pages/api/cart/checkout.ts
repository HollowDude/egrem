import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { checkoutCart, CART_GROUP_COOKIE } from '@/lib/nodehive/carrito';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Procesa (coloca) todas las órdenes del grupo en una sola llamada. */
export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);
  const cartGroup = cookies.get(CART_GROUP_COOKIE)?.value ?? null;
  if (!cartGroup) return json({ message: 'no_cart' }, 400);
  try {
    const result = await checkoutCart(cartGroup, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      uid: session.uid,
    });
    // Tras el checkout el grupo queda vacío: limpiamos la cookie.
    cookies.delete(CART_GROUP_COOKIE, { path: '/' });
    return json({ ok: true, result }, 200);
  } catch (e) {
    console.error('[api/cart/checkout] error:', e);
    return json({ message: 'checkout_error' }, 500);
  }
};
