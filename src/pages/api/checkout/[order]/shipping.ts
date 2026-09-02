import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { guardarEnvio, type ShippingMethod } from '@/lib/nodehive/checkout';

const ALLOWED: ShippingMethod[] = ['pickup'];

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const orderId = params.order;
  if (!orderId) return new Response(JSON.stringify({ error: 'Falta order.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const method = String(body.shipping_method ?? body.shippingMethod ?? body.method ?? '').trim() as ShippingMethod;
    if (!ALLOWED.includes(method)) {
      return new Response(JSON.stringify({ error: 'Método de envío no permitido. Solo pickup disponible.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const order = await guardarEnvio(orderId, method, {
      accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/shipping]', e);
    return new Response(JSON.stringify({ error: 'No se pudo guardar el envío.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
