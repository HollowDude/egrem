import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getCart } from '@/lib/nodehive/carrito';

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
  try {
    const cart = await getCart({
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
    });
    return json(cart, 200);
  } catch (e) {
    console.error('[api/cart] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
