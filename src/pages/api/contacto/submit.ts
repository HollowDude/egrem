import type { APIRoute } from 'astro';
import { validateContact, type ContactField, type ContactErrorCode } from '@/lib/contacto/validation';

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
const rateMap = new Map<string, { count: number; resetAt: number }>();

const DRUPAL_BASE_URL = (import.meta.env.NODEHIVE_BASE_URL ?? '').replace(/\/$/, '');

const ERROR_MESSAGES: Record<ContactErrorCode, string> = {
  inquiry_required: 'El tipo de consulta es requerido.',
  name_required: 'El nombre debe tener al menos 2 caracteres.',
  email_invalid: 'Correo electrónico inválido.',
  message_required: 'El mensaje es requerido.',
  message_too_short: 'El mensaje debe tener al menos 10 caracteres.',
  message_too_long: 'El mensaje no puede exceder 500 caracteres.',
};

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

function validate(
  body: Record<string, unknown>
): { field: ContactField; code: ContactErrorCode } | null {
  const errors = validateContact({
    inquiry: body.inquiry as string | undefined ?? '',
    name: body.name as string | undefined ?? '',
    email: body.email as string | undefined ?? '',
    message: body.message as string | undefined ?? '',
  });
  const field = (Object.keys(errors) as ContactField[])[0];
  if (!field || !errors[field]) return null;
  return { field, code: errors[field] };
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
      return new Response(
        JSON.stringify({
          error: ERROR_MESSAGES[validationError.code],
          code: validationError.code,
          field: validationError.field,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const payload = {
      name: (body.name as string).trim(),
      email: (body.email as string).trim(),
      phone: ((body.phone as string) ?? '').trim(),
      company: body.empresa ?? body.company ?? '',
      sede: body.sede ?? '',
      tipo_consulta: body.inquiry ?? '',
      message: (body.message as string).trim(),
    };

    if (!DRUPAL_BASE_URL) {
      console.warn('[Contacto] NODEHIVE_BASE_URL not set, skipping Drupal relay');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const drupalResponse = await fetch(`${DRUPAL_BASE_URL}/submit.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!drupalResponse.ok) {
      const errorText = await drupalResponse.text();
      console.error('[Contacto] Drupal relay failed:', drupalResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Ocurrió un error al procesar la solicitud.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await drupalResponse.json();
    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
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
