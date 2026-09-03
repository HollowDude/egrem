import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { guardarMetodoPago, type PaymentMethodValue } from '@/lib/nodehive/checkout';

const ALLOWED: PaymentMethodValue[] = ['efectivo', 'transfermovil'];

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const orderId = params.order;
  if (!orderId) return new Response(JSON.stringify({ error: 'Falta order.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const method = String(body.payment_method ?? body.paymentMethod ?? body.method ?? '').trim() as PaymentMethodValue;
    if (!ALLOWED.includes(method)) {
      return new Response(JSON.stringify({ error: 'Método de pago no disponible por ahora.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const order = await guardarMetodoPago(orderId, method, {
      accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/payment-method]', e);
    return new Response(JSON.stringify({ error: 'No se pudo guardar el método de pago.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
