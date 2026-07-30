import type { APIRoute } from 'astro';

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function isSpam(body: Record<string, unknown>): boolean {
  if (body.hp && typeof body.hp === 'string' && body.hp.length > 0) return true;
  if (body.website && typeof body.website === 'string' && body.website.length > 0) return true;
  return false;
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function validate(body: Record<string, unknown>): string | null {
  const inquiry = body.inquiry as string | undefined;
  const name = body.name as string | undefined;
  const email = body.email as string | undefined;
  const message = body.message as string | undefined;

  if (!inquiry || typeof inquiry !== 'string' || inquiry.length < 1) {
    return 'El tipo de consulta es requerido.';
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.';
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Correo electrónico inválido.';
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return 'El mensaje debe tener al menos 10 caracteres.';
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (isSpam(body)) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (rateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validationError = validate(body);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      inquiry: body.inquiry,
      name: (body.name as string).trim(),
      email: (body.email as string).trim(),
      message: (body.message as string).trim(),
      timestamp: new Date().toISOString(),
    };

    console.log('[Contacto] Form submission:', JSON.stringify(payload));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[Contacto] Submit error:', e);
    return new Response(JSON.stringify({ error: 'Ocurrió un error al procesar la solicitud.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
