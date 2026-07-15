import type { APIRoute } from 'astro';
import { registerUser } from '@/lib/nodehive/register';
import { isValidLang, DEFAULT_LANG } from '@/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return json({ error: 'El cuerpo de la petición debe ser JSON.' }, 400);
    }
    const { username, email } = body as Record<string, string>;

    if (!username?.trim() || username.trim().length < 3) {
      return json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' }, 400);
    }
    if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
      return json({ error: 'El correo electrónico no es válido.' }, 400);
    }

    const lang = isValidLang(locals.lang) ? locals.lang : DEFAULT_LANG;

    const result = await registerUser({
      name: username.trim(),
      mail: email.trim(),
      lang,
    });

    if (!result.ok) {
      return json({ error: result.error || 'No se pudo crear la cuenta.' }, result.statusCode ?? 500);
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error('[auth/register]', e);
    return json({ error: 'Ocurrió un error. Inténtalo de nuevo.' }, 500);
  }
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
