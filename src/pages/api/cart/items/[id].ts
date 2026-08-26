import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { updateCartItem, removeCartItem } from '@/lib/nodehive/carrito';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const id = params.id!;
  let quantity = 1;
  try {
    const body = (await request.json()) as { quantity?: number };
    quantity = body.quantity ?? 1;
  } catch {
    return json({ message: 'invalid_json' }, 400);
  }
  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);
  try {
    const cart = await updateCartItem(id, quantity, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      uid: session.uid,
    });
    return json(cart, 200);
  } catch (e) {
    console.error('[api/cart/items] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const id = params.id!;
  const session = await getSession(cookies);
  if (!session) return json({ message: 'login_required' }, 401);
  try {
    const cart = await removeCartItem(id, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      uid: session.uid,
    });
    return json(cart, 200);
  } catch (e) {
    console.error('[api/cart/items] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
