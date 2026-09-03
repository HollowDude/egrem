import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { crearQRTransfermovil } from '@/lib/nodehive/checkout';
import { CheckoutApiError } from '@/lib/nodehive/checkout';

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const raw = cookies.get('egrem_checkout_orders')?.value ?? cookies.get('egrem_cart_group')?.value ?? '';
  let cartGroup = '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cartGroup = parsed.cartGroup ?? parsed.cart_group ?? raw;
      if (!cartGroup && typeof raw === 'string' && raw.length > 10) cartGroup = raw;
    } catch {
      cartGroup = raw;
    }
    // raw may be plain string if from egrem_cart_group
    if (!cartGroup) cartGroup = cookies.get('egrem_checkout_orders')?.value ? JSON.parse(cookies.get('egrem_checkout_orders')!.value!).cartGroup : cookies.get('egrem_cart_group')?.value ?? '';
  }
  // Fallback: try both cookies
  if (!cartGroup) {
    const c1 = cookies.get('egrem_checkout_orders')?.value;
    if (c1) try { cartGroup = JSON.parse(c1).cartGroup ?? ''; } catch {}
    if (!cartGroup) cartGroup = cookies.get('egrem_cart_group')?.value ?? '';
  }
  if (!cartGroup) return new Response(JSON.stringify({ error: 'no_cart_group', code: 400 }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const qr = await crearQRTransfermovil(cartGroup, {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify(qr), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const err = e as CheckoutApiError;
    const status = err.status ?? 500;
    const body = err.body as Record<string, unknown> | null;
    const msg = (body?.error as string) ?? err.message ?? 'No se pudo crear el QR.';
    return new Response(JSON.stringify({ error: msg, code: status, details: body }), { status: status >= 400 && status < 600 ? status : 500, headers: { 'Content-Type': 'application/json' } });
  }
};
