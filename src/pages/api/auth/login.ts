import type { APIRoute } from 'astro';
import { loginWithDrupal, serializeUser } from '@/lib/auth/drupal-auth';

const SESSION_COOKIE = 'egrem_session';
const SESSION_MAX_AGE = 60 * 60 * 24; // 1 day

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { user } = await loginWithDrupal(email, password);

    cookies.set(SESSION_COOKIE, serializeUser(user), {
      path: '/',
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return new Response(
      JSON.stringify({ success: true, user: { uid: user.uid, name: user.name, mail: user.mail } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'INVALID_CREDENTIALS') {
      return new Response(
        JSON.stringify({ error: 'Correo o contraseña incorrectos.' }),
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
