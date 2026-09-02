import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { confirmarPedido } from '@/lib/nodehive/checkout';

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  let cartGroup: string | undefined;
  const raw = cookies.get('egrem_checkout_orders')?.value;
  if (raw) {
    try { cartGroup = JSON.parse(raw).cartGroup; } catch {}
  }
  if (!cartGroup) cartGroup = cookies.get('egrem_cart_group')?.value ?? undefined;
  if (!cartGroup) {
    return new Response(JSON.stringify({ error: 'No hay grupo de carrito.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const result = await confirmarPedido(cartGroup, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    cookies.delete('egrem_cart_group', { path: '/' });
    cookies.delete('egrem_checkout_orders', { path: '/' });
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/place]', e);
    const msg = String((e as Error)?.message ?? '');
    return new Response(JSON.stringify({ error: msg || 'No se pudo confirmar el pedido.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
