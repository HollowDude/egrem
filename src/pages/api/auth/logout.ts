import type { APIRoute } from 'astro';
import { getSession, destroySession, isSecureRequest } from '@/lib/auth/session';
import { logoutFromDrupal } from '@/lib/auth/drupal-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);

  if (session?.logoutToken) {
    await logoutFromDrupal(session.logoutToken);
  }

  destroySession(cookies, isSecureRequest(request));

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
