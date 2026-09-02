import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { actualizarDireccion, borrarDireccion } from '@/lib/nodehive/direcciones';

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
    if (body.countryCode !== undefined) patch.countryCode = String(body.countryCode).trim();
    if (body.addressLine2 !== undefined) patch.addressLine2 = String(body.addressLine2).trim();
    if (body.postalCode !== undefined) patch.postalCode = String(body.postalCode).trim();
    if (body.firstName !== undefined) patch.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) patch.lastName = String(body.lastName).trim();
    if (body.phone !== undefined) patch.phone = String(body.phone).trim();
    if (body.ciPassport !== undefined) patch.ciPassport = String(body.ciPassport).trim();
    if (body.isDefault !== undefined || body.is_default !== undefined) patch.isDefault = Boolean(body.isDefault ?? body.is_default);

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
