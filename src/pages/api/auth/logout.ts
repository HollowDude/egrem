import type { APIRoute } from 'astro';
import { getSession, destroySession } from '@/lib/auth/session';
import { logoutFromDrupal } from '@/lib/auth/drupal-auth';

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);

  if (session?.logoutToken) {
    await logoutFromDrupal(session.logoutToken);
  }

  destroySession(cookies);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
