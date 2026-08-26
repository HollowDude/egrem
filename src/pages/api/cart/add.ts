import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { addToCart, type AddToCartInput } from '@/lib/nodehive/carrito';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let payload: AddToCartInput;
  try {
    payload = (await request.json()) as AddToCartInput;
  } catch {
    return json({ message: 'invalid_json' }, 400);
  }

  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);

  try {
    const cart = await addToCart([payload], {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      uid: session.uid,
    });
    return json({ ok: true, count: cart.count }, 200);
  } catch (e) {
    console.error('[api/cart/add] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
