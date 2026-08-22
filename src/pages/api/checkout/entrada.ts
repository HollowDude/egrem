import type { APIRoute } from 'astro';
import { fetchEventoById, type NhEventoDetalle } from '@/lib/nodehive';
import { getBaseUrlValue } from '@/lib/nodehive/client';
import { procesarCheckout, type CheckoutPayload } from '@/lib/tienda/checkout';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  let payload: CheckoutPayload;
  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return json({ message: 'invalid_json' }, 400);
  }

  const lang = url.searchParams.get('lang') ?? 'es';

  // Revalidación server-side contra Drupal (best-effort).
  let evento: NhEventoDetalle | null = null;
  if (payload.eventoId) {
    evento = await fetchEventoById(payload.eventoId, lang);
  }

  const resultado = procesarCheckout(payload, evento);
  if (!resultado.ok) {
    return json({ message: resultado.message }, resultado.status);
  }

  // ─── Integración real con Drupal Commerce ───────────────────────────────
  // TODO (sección 3 del plan): reemplazar el stub por la llamada real una vez
  // confirmado el contrato:
  //   A) Commerce Cart/Checkout API estándar → crear order_item y redirigir a
  //      /checkout/{order}.
  //   B) Endpoint custom POST /api/checkout/entrada (Drupal) → devuelve
  //      { checkoutUrl }.
  // Hasta entonces, CHECKOUT_STUB (o ausencia de CHECKOUT_REAL) simula la
  // respuesta para no bloquear el flujo de UI.
  const usarStub = import.meta.env.CHECKOUT_STUB === 'true' || !import.meta.env.CHECKOUT_REAL;
  if (usarStub) {
    const base = getBaseUrlValue();
    const order = crypto.randomUUID();
    const checkoutUrl = `${base}/checkout/stub?order=${order}`;
    return json({ checkoutUrl }, 200);
  }

  // TODO: const checkoutUrl = await llamarCheckoutReal(payload, resultado);
  return json({ message: 'checkout_real_no_implementado' }, 501);
};
