import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { guardarFacturacionConPerfil, guardarFacturacionInline } from '@/lib/nodehive/checkout';

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const orderId = params.order;
  if (!orderId) return new Response(JSON.stringify({ error: 'Falta order.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const profileId = (body.profile_id ?? body.profileId) as string | undefined;
    const hasAddressFields = !!(body.address || body.addressLine1 || body.address_line1 || body.firstName || body.first_name);
    const isEmptyBody = Object.keys(body).length === 0;
    let order;
    if (profileId) {
      order = await guardarFacturacionConPerfil(orderId, String(profileId), {
        accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
      });
    } else if (isEmptyBody) {
      // Usa la dirección predeterminada (Drupal la resuelve si no mandas profile_id)
      const { guardarFacturacionInline } = await import('@/lib/nodehive/checkout');
      // Intentar con body vacío: Drupal usará is_default si existe
      try {
        const { listarDirecciones } = await import('@/lib/nodehive/direcciones');
        const dirs = await listarDirecciones({
          uid: session.uid,
          accessToken: session.accessToken,
          csrfToken: session.csrfToken,
          sessionCookie: session.sessionCookie,
        });
        const def = dirs.find((d) => d.isDefault) ?? dirs[0];
        if (def) {
          order = await guardarFacturacionConPerfil(orderId, def.uuid, {
            accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
          });
        } else {
          return new Response(JSON.stringify({ error: 'No hay dirección predeterminada.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch {
        // Fallback: mandar body vacío y dejar que Drupal resuelva default
        order = await guardarFacturacionConPerfil(orderId, '', {
          accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
        });
      }
    } else if (hasAddressFields) {
      // Inline: soporta tanto {address:{...}} como campos sueltos
      const address = body.address as Record<string, unknown> | undefined;
      const isDefault = body.is_default === true || body.isDefault === true;
      const payload = {
        countryCode: String((address as Record<string, unknown> | undefined)?.country_code ?? body.countryCode ?? body.country_code ?? 'CU'),
        administrativeArea: String((address as Record<string, unknown> | undefined)?.administrative_area ?? body.administrativeArea ?? body.administrative_area ?? ''),
        locality: String((address as Record<string, unknown> | undefined)?.locality ?? body.locality ?? ''),
        addressLine1: String((address as Record<string, unknown> | undefined)?.address_line1 ?? body.addressLine1 ?? body.address_line1 ?? body.line1 ?? ''),
        addressLine2: String((address as Record<string, unknown> | undefined)?.address_line2 ?? body.addressLine2 ?? body.address_line2 ?? ''),
        postalCode: String((address as Record<string, unknown> | undefined)?.postal_code ?? body.postalCode ?? body.postal_code ?? ''),
        firstName: String(body.firstName ?? body.first_name ?? body.field_first_name ?? (address as Record<string, unknown> | undefined)?.given_name ?? ''),
        lastName: String(body.lastName ?? body.last_name ?? body.field_last_name ?? (address as Record<string, unknown> | undefined)?.family_name ?? ''),
        phone: String(body.phone ?? body.field_phone ?? ''),
        ciPassport: String(body.ciPassport ?? body.ci_passport ?? body.field_ci_passport ?? ''),
        isDefault,
      };
      if (!payload.addressLine1 || !payload.locality) {
        return new Response(JSON.stringify({ error: 'Faltan campos de dirección.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      order = await guardarFacturacionInline(orderId, payload as never, {
        accessToken: session.accessToken, csrfToken: session.csrfToken, sessionCookie: session.sessionCookie,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Se requiere profile_id o address.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[api/checkout/billing]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('404')) return new Response(JSON.stringify({ error: 'Dirección no encontrada.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'No se pudo guardar la facturación.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
