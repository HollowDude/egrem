import type { APIRoute } from 'astro';
import { checkEmailExists } from '@/lib/nodehive/forgotPassword';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const email = (body as Record<string, string> | null)?.email;

  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'El correo electrónico no es válido.' }, 400);
  }

  const result = await checkEmailExists(email.trim());

  if (!result.exists) {
    return json({ exists: false }, 200);
  }

  return json({ exists: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}