import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { actualizarDireccion, borrarDireccion, listarDirecciones } from '@/lib/nodehive/direcciones';

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uuid = params.uuid as string;
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.addressLine1 !== undefined) patch.addressLine1 = String(body.addressLine1).trim();
    if (body.administrativeArea !== undefined) patch.administrativeArea = String(body.administrativeArea).trim();
    if (body.locality !== undefined) patch.locality = String(body.locality).trim();
    if (body.countryCode !== undefined || body.country_code !== undefined)
      patch.countryCode = String(body.countryCode ?? body.country_code ?? '').trim();
    if (body.addressType !== undefined || body.field_address_type !== undefined)
      patch.addressType = String(body.addressType ?? body.field_address_type ?? '').trim();
    if (body.addressLine2 !== undefined) patch.addressLine2 = String(body.addressLine2).trim();
    if (body.postalCode !== undefined) patch.postalCode = String(body.postalCode).trim();
    if (body.firstName !== undefined) patch.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) patch.lastName = String(body.lastName).trim();
    if (body.phone !== undefined) patch.phone = String(body.phone).trim();
    if (body.ciPassport !== undefined) patch.ciPassport = String(body.ciPassport).trim();
    if (body.isDefault !== undefined || body.is_default !== undefined) patch.isDefault = Boolean(body.isDefault ?? body.is_default);

    if (patch.addressType !== undefined && patch.addressType !== 'billing' && patch.addressType !== 'shipping') {
      return new Response(JSON.stringify({ error: 'Tipo de dirección inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (patch.countryCode !== undefined && !patch.countryCode) {
      return new Response(JSON.stringify({ error: 'Falta el país.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Validar regla shipping=Cuba contra el tipo/país efectivos (nuevo o existente)
    if (patch.addressType !== undefined || patch.countryCode !== undefined) {
      let effectiveType = patch.addressType as string | undefined;
      let effectiveCountry = patch.countryCode as string | undefined;
      if (effectiveType === undefined || effectiveCountry === undefined) {
        const auth = {
          uid: session.uid,
          accessToken: session.accessToken,
          csrfToken: session.csrfToken,
          sessionCookie: session.sessionCookie,
        };
        const dirs = await listarDirecciones(auth);
        const current = dirs.find((d) => d.uuid === uuid);
        if (effectiveType === undefined) effectiveType = current?.addressType ?? 'shipping';
        if (effectiveCountry === undefined) effectiveCountry = current?.countryCode ?? 'CU';
      }
      if (effectiveType === 'shipping' && effectiveCountry !== 'CU') {
        return new Response(JSON.stringify({ error: 'Las direcciones de envío deben estar en Cuba.' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: 'Nada para actualizar.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const actualizada = await actualizarDireccion(
      uuid,
      patch as never,
      {
        uid: session.uid,
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        sessionCookie: session.sessionCookie,
      },
    );

    return new Response(JSON.stringify(actualizada), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/direcciones PATCH]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'No autorizado para editar esta dirección.' }), {
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
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Dirección no encontrada.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo actualizar la dirección.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uuid = params.uuid as string;
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'Falta uuid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await borrarDireccion(uuid, {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('[api/user/direcciones DELETE]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'No autorizado para eliminar esta dirección.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Dirección no encontrada.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la dirección.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
