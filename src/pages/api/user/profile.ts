import type { APIRoute } from 'astro';
import { getSession } from '@/lib/auth/session';
import { getUserProfile, updateUserProfile } from '@/lib/nodehive/user';

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
    const { displayName, newPassword } = body;

    const result = await updateUserProfile(session.uid, session.accessToken, {
      displayName,
      newPassword: newPassword || undefined,
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
