import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getCart, CART_GROUP_COOKIE, CART_GROUP_COOKIE_MAX_AGE } from '@/lib/nodehive/carrito';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);
  const cartGroup = cookies.get(CART_GROUP_COOKIE)?.value ?? null;
  try {
    const cart = await getCart(
      {
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        uid: session.uid,
        sessionCookie: session.sessionCookie,
      },
      cartGroup,
    );
    // Si el backend devolvió un cartGroup y no teníamos cookie, persistirlo.
    // Esto cubre el caso post-login donde el usuario ya tiene un carrito en Drupal
    // pero el navegador aún no tiene la cookie (ej. login en otro dispositivo o tras limpiar cookies).
    if (cart.cartGroup && cart.cartGroup !== cartGroup) {
      cookies.set(CART_GROUP_COOKIE, cart.cartGroup, {
        path: '/',
        maxAge: CART_GROUP_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      });
    }
    return json(cart, 200);
  } catch (e) {
    console.error('[api/cart] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
