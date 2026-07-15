import type { APIRoute } from 'astro';
import { requestPasswordReset } from '@/lib/nodehive/forgotPassword';
import { isValidLang, DEFAULT_LANG } from '@/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const email = (body as Record<string, string> | null)?.email;

  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'El correo electrónico no es válido.' }, 400);
  }

  const lang = isValidLang(locals.lang) ? locals.lang : DEFAULT_LANG;
  const result = await requestPasswordReset(email.trim(), lang);

  if (!result.ok && result.statusCode && result.statusCode < 500) {
    return json({ success: true }, 200);
  }
  if (!result.ok) {
    return json({ error: result.error }, result.statusCode ?? 503);
  }

  return json({ success: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
