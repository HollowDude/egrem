import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { addToCart, CART_GROUP_COOKIE, CART_GROUP_COOKIE_MAX_AGE, type AddToCartInput } from '@/lib/nodehive/carrito';

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

  // Grupo de pedido existente (cookie httpOnly) o undefined → el backend crea uno nuevo.
  const cartGroup = cookies.get(CART_GROUP_COOKIE)?.value ?? undefined;

  try {
    const cart = await addToCart([payload], {
      accessToken: session.accessToken,
      sessionCookie: session.sessionCookie,
      csrfToken: session.csrfToken,
      uid: session.uid,
    }, cartGroup);
    // Persistir el cart_group devuelto para futuras llamadas.
    if (cart.cartGroup) {
      cookies.set(CART_GROUP_COOKIE, cart.cartGroup, {
        path: '/',
        maxAge: CART_GROUP_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      });
    }
    return json({ ok: true, count: cart.count, cartGroup: cart.cartGroup }, 200);
  } catch (e) {
    const msg = String((e as Error)?.message ?? '');
    if (msg.startsWith('STOCK_INSUFFICIENT:')) {
      const disponible = Number(msg.split(':')[1] || '0');
      return json({ message: 'stock_insufficient', disponible }, 409);
    }
    // Errores 4xx del backend (p.ej. store_id vacío/inválido) son del cliente,
    // no del servidor: se devuelven como 400 sin registrarlos como crash.
    if (/40[0-9]/.test(msg) || /Cuerpo inválido|store_id inválido/.test(msg)) {
      return json({ message: 'invalid_request' }, 400);
    }
    console.error('[api/cart/add] error:', e);
    return json({ message: 'cart_error' }, 500);
  }
};
