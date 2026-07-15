import type { APIRoute } from 'astro';
import { setPasswordFromOneTimeLogin } from '@/lib/nodehive/setPassword';
import { setSession } from '@/lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const { uid, timestamp, hash, password } = (body ?? {}) as Record<string, string>;

  if (!uid || !timestamp || !hash || !password) {
    return json({ error: 'Parámetros incompletos.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  }

  const result = await setPasswordFromOneTimeLogin({ uid, timestamp, hash, newPassword: password });

  if (!result.ok) {
    return json({ error: result.error }, result.statusCode ?? 400);
  }

  if (result.data) {
    await setSession(cookies, result.data);
    return json({ success: true, user: { name: result.data.name } }, 200);
  }

  return json({ success: true, user: null, requiresLogin: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
