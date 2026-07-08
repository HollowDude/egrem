import type { APIRoute } from 'astro';
import { loginWithDrupal } from '@/lib/auth/drupal-auth';
import { createSessionCookie } from '@/lib/auth/session';

const SESSION_COOKIE = 'egrem_session';
const SESSION_MAX_AGE = 60 * 60 * 24; // 1 day

function isSecureRequest(request: Request): boolean {
  return request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
}

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

    // Create a signed session cookie (no roles included for security)
    const sessionValue = createSessionCookie(
      { uid: user.uid, name: user.name, mail: user.mail, roles: [] },
      SESSION_MAX_AGE,
    );

    cookies.set(SESSION_COOKIE, sessionValue, {
      path: '/',
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: isSecureRequest(request),
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
