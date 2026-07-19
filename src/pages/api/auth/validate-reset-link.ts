import type { APIRoute } from 'astro';
import { validateResetLink } from '@/lib/nodehive/validateResetLink';

export const GET: APIRoute = async ({ url }) => {
  const uid = url.searchParams.get('uid')?.trim();
  const timestamp = url.searchParams.get('timestamp')?.trim();
  const hash = url.searchParams.get('hash')?.trim();

  if (!uid || !timestamp || !hash) {
    return json({ valid: false, error: 'Missing required parameters.' }, 400);
  }

  const result = await validateResetLink(uid, timestamp, hash);
  return json(result, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
