import type { APIRoute } from 'astro';
import { loginWithDrupal } from '@/lib/auth/drupal-auth';
import { setSession } from '@/lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { user } = await loginWithDrupal(username, password);

    await setSession(cookies, user);

    return new Response(
      JSON.stringify({ success: true, user: { uid: user.uid, name: user.name, mail: user.mail } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'INVALID_CREDENTIALS') {
      return new Response(
        JSON.stringify({ error: 'Usuario o contraseña incorrectos.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    console.error('[auth/login]', e);
    return new Response(
      JSON.stringify({ error: 'Ocurrió un error. Inténtalo de nuevo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
