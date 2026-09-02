import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { obtenerPedido, obtenerPedidoAgrupado, cancelarPedido, borrarPedido } from '@/lib/nodehive/pedidos';

export const GET: APIRoute = async ({ params, cookies }) => {
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
    // Intentar agrupado (si tiene cart_group, trae todos los hermanos)
    let pedido;
    try {
      pedido = await obtenerPedidoAgrupado(uuid, {
        uid: session.uid,
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        sessionCookie: session.sessionCookie,
      });
    } catch {
      pedido = await obtenerPedido(uuid, {
        uid: session.uid,
        accessToken: session.accessToken,
        csrfToken: session.csrfToken,
        sessionCookie: session.sessionCookie,
      });
    }
    return new Response(JSON.stringify(pedido), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/pedidos GET uuid]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo cargar el pedido.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== 'cancel') {
      return new Response(JSON.stringify({ error: 'Acción no soportada.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const auth = {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    };
    // Si es parte de un grupo estricto, cancelar todos del mismo grupo
    let uuidsToCancel = [uuid];
    try {
      const { obtenerPedidoAgrupado } = await import('@/lib/nodehive/pedidos');
      const agrupado = await obtenerPedidoAgrupado(uuid, auth);
      if (agrupado.hermanos.length > 0) {
        uuidsToCancel = [uuid, ...agrupado.hermanos.map((h) => h.uuid)];
      } else if (agrupado.cartGroupUuid) {
        // Fallback por si el agrupado no trajo hermanos pero hay grupo estricto
        const { listarPedidosPorCartGroup, obtenerPedido } = await import('@/lib/nodehive/pedidos');
        const base = await obtenerPedido(uuid, auth);
        if (base.cartGroupUuid) {
          const hermanos = await listarPedidosPorCartGroup(base.cartGroupUuid, auth);
          const mismoGrupo = hermanos.filter((h) => h.state === base.state);
          if (mismoGrupo.length > 1) uuidsToCancel = mismoGrupo.map((h) => h.uuid);
        }
      }
    } catch {}
    for (const id of uuidsToCancel) {
      try {
        await cancelarPedido(id, {
          uid: session.uid,
          accessToken: session.accessToken,
          csrfToken: session.csrfToken,
          sessionCookie: session.sessionCookie,
        });
      } catch (e) {
        // Si uno falla por ser completed, continuar con los demás
        if (uuidsToCancel.length === 1) throw e;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/user/pedidos PATCH]', e);
    const msg = String((e as Error)?.message ?? '');
    // Si Drupal responde 403 por isLocked, devolvemos 409 con mensaje claro
    if (msg.includes('403') || msg.includes('422')) {
      return new Response(JSON.stringify({ error: 'Este pedido no se puede cancelar.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const detail = (msg.match(/detail[^"]*"([^"]+)"/)?.[1] as string | undefined) ?? undefined;
    return new Response(JSON.stringify({ error: detail || 'No se pudo cancelar el pedido.' }), {
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
    const auth = {
      uid: session.uid,
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      sessionCookie: session.sessionCookie,
    };
    let uuidsToDelete = [uuid];
    try {
      const { obtenerPedidoAgrupado } = await import('@/lib/nodehive/pedidos');
      const agrupado = await obtenerPedidoAgrupado(uuid, auth);
      if (agrupado.hermanos.length > 0) {
        uuidsToDelete = [uuid, ...agrupado.hermanos.map((h) => h.uuid)];
      }
    } catch {
      try {
        const { obtenerPedido, listarPedidosPorCartGroup } = await import('@/lib/nodehive/pedidos');
        const base = await obtenerPedido(uuid, auth);
        if (base.cartGroupUuid) {
          const hermanos = await listarPedidosPorCartGroup(base.cartGroupUuid, auth);
          if (hermanos.length > 1) uuidsToDelete = hermanos.map((h) => h.uuid);
        }
      } catch {}
    }
    let lastError: unknown = null;
    for (const id of uuidsToDelete) {
      try {
        await borrarPedido(id, {
          uid: session.uid,
          accessToken: session.accessToken,
          csrfToken: session.csrfToken,
          sessionCookie: session.sessionCookie,
        });
      } catch (e) {
        lastError = e;
        if (uuidsToDelete.length === 1) throw e;
        // Para grupo, continuar aunque uno falle
      }
    }
    if (lastError && uuidsToDelete.length > 1) {
      // Si todos fallaron, propagar error
      const stillExist = await (async () => {
        try {
          const { obtenerPedido } = await import('@/lib/nodehive/pedidos');
          await obtenerPedido(uuid, auth);
          return true;
        } catch { return false; }
      })();
      if (stillExist) throw lastError;
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('[api/user/pedidos DELETE]', e);
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('403')) {
      return new Response(JSON.stringify({ error: 'Este pedido no se puede eliminar.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (msg.includes('404')) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'No se pudo eliminar el pedido.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
