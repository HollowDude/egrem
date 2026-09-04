import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { listarDirecciones, crearDireccion } from '@/lib/nodehive/direcciones';
import { countryUsesAdminArea } from '@/lib/geo/drupalZones';
import { isValidPhoneNumber } from 'libphonenumber-js';

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const direcciones = await listarDirecciones({
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    return new Response(JSON.stringify(direcciones), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/direcciones GET]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('401') || msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo cargar direcciones.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const addressLine1 = String(body.addressLine1 ?? '').trim();
    const administrativeArea = String(body.administrativeArea ?? '').trim();
    const locality = String(body.locality ?? '').trim();
    const countryCode = String(body.countryCode ?? body.country_code ?? '').trim();
    const addressType = String(body.addressType ?? body.field_address_type ?? 'shipping').trim() as 'billing' | 'shipping';
    if (addressType !== 'billing' && addressType !== 'shipping') {
      return new Response(JSON.stringify({ error: 'Tipo de dirección inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!countryCode) {
      return new Response(JSON.stringify({ error: 'Falta el país.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (addressType === 'shipping' && countryCode !== 'CU') {
      return new Response(JSON.stringify({ error: 'Las direcciones de envío deben estar en Cuba.' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const addressLine2 = String(body.addressLine2 ?? '').trim();
    const postalCode = String(body.postalCode ?? '').trim();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const ciPassport = String(body.ciPassport ?? '').trim();
    const isDefault = body.isDefault === true || body.is_default === true;

    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: nombre y apellidos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: 'El teléfono es obligatorio.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!isValidPhoneNumber(phone)) {
      return new Response(JSON.stringify({ error: 'Ingresa un número de teléfono válido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!ciPassport) {
      return new Response(JSON.stringify({ error: 'El CI/Pasaporte es obligatorio.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!addressLine1 || !locality || (countryUsesAdminArea(countryCode) && !administrativeArea)) {
      return new Response(
        JSON.stringify({
          error: countryUsesAdminArea(countryCode)
            ? 'Faltan campos obligatorios: dirección, provincia y municipio.'
            : 'Faltan campos obligatorios: dirección y municipio.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const nueva = await crearDireccion(
      {
        addressType,
        countryCode,
        administrativeArea,
        locality,
        addressLine1,
        addressLine2,
        postalCode,
        firstName,
        lastName,
        phone,
        ciPassport,
        isDefault,
      } as never,
      {
        uid: session.uid,
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        sessionCookie: session.sessionCookie,
      },
    );

    return new Response(JSON.stringify(nueva), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/direcciones POST]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'No autorizado para crear dirección.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (msg.includes('422')) {
      const m = msg.match(/"detail":"((?:[^"\\]|\\.)*)"/);
      let detail = 'Datos de dirección inválidos para ese país.';
      if (m) {
        try { detail = JSON.parse(`"${m[1]}"`); } catch { detail = m[1]; }
      }
      return new Response(JSON.stringify({ error: detail }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo crear la dirección.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
