import type { APIRoute } from 'astro';
import { registerUser } from '@/lib/nodehive/register';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, email } = body;

    if (!username || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await registerUser({
      name: username,
      mail: email,
    });

    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: result.error || 'No se pudo crear la cuenta.' }),
        { status: result.statusCode || 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[auth/register]', e);
    return new Response(
      JSON.stringify({ error: 'Ocurrió un error. Inténtalo de nuevo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
