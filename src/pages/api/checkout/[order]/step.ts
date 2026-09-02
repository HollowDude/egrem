import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { cambiarPaso, type CheckoutStep } from '@/lib/nodehive/checkout';

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const orderId = params.order;
  if (!orderId) return new Response(JSON.stringify({ error: 'Falta order.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const step = String(body.checkout_step ?? body.step ?? '').trim() as CheckoutStep;
    if (!step) return new Response(JSON.stringify({ error: 'Falta checkout_step.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const order = await cambiarPaso(orderId, step, {
      accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/step]', e);
    return new Response(JSON.stringify({ error: 'No se pudo cambiar de paso.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
