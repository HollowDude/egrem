import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { removeCartStore, CART_GROUP_COOKIE } from '@/lib/nodehive/carrito';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Stopgap (plan §1.4): vaciar el pedido completo de una tienda por `order_id`. */
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const orderId = Number(params.id);
  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);
  try {
    const cart = await removeCartStore(
      orderId,
      {
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        uid: session.uid,
      },
      cookies.get(CART_GROUP_COOKIE)?.value,
    );
    return json(cart, 200);
  } catch (e) {
    console.error('[api/cart/store] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
