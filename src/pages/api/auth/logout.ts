import type { APIRoute } from 'astro';

const SESSION_COOKIE = 'egrem_session';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, {
    path: '/',
  });

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
