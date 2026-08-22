import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getUserProfile, updateUserProfile } from '@/lib/nodehive/user';
import { isValidPassword } from '@/utils/passwordValidation';

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profile = await getUserProfile(session.uid, session.accessToken);

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Could not fetch profile.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(profile), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
    const body = await request.json();
    const { displayName, newPassword, currentPassword } = body as Record<string, unknown>;

    if (newPassword !== undefined && newPassword !== null && newPassword !== '') {
      if (typeof newPassword !== 'string') {
        return new Response(JSON.stringify({ error: 'La contraseña debe ser un texto.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (typeof currentPassword !== 'string' || currentPassword.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Para cambiar la contraseña debes indicar la actual.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (!isValidPassword(newPassword)) {
        return new Response(
          JSON.stringify({
            error: 'La nueva contraseña debe tener al menos 8 caracteres, letras y números.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    const result = await updateUserProfile(session.uid, session.accessToken, {
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName : undefined,
      currentPassword:
        typeof currentPassword === 'string' && currentPassword.trim() ? currentPassword : undefined,
      newPassword: typeof newPassword === 'string' && newPassword.trim() ? newPassword : undefined,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || 'No se pudo actualizar.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[user/profile]', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
