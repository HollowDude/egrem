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
    const msg = String((e as any)?.message ?? e);
    const stockMatch = msg.match(/^STOCK_INSUFFICIENT:(-?\d+)/);
    if (stockMatch) {
      // TODO(stock-multitienda): `disponible` es stock de TIENDA DEFAULT
      // (field_stock_level, ver obtenerStockVariacion en carrito.ts / plan §8), no el
      // total agregado multitienda mostrado en la ficha.
      return json(
        {
          error: 'stock_insufficient',
          message: 'No hay suficiente stock disponible.',
          disponible: Number(stockMatch[1]),
        },
        409,
      );
    }
    if (msg.includes('USER_NOT_AUTHENTICATED') || msg.includes('401')) {
      return json({ error: 'no_autenticado', message: 'Inicia sesión para modificar el carrito.' }, 401);
    }
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
