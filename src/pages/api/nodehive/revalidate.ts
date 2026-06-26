import type { APIRoute } from 'astro';

/**
 * POST /api/nodehive/revalidate
 *
 * Drupal llama a este endpoint (via postMessage → fetch del conector) cuando
 * guarda cambios en un paragraph o fragment. Limpia el caché de la aplicación.
 *
 * Body esperado (JSON):
 *   { path?: string, type?: string, bundle?: string }
 *
 * TODO(nodehive): implementar invalidación de caché real (purgar CDN, etc.)
 * Hoy solo hace logging del evento.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    /* body vacío — ok */
  }

  const { path, type, bundle, event } = body as Record<string, string>;

  console.log(
    `[NodeHive Revalidate] ${event ?? 'update'} | type: ${type ?? '-'} | bundle: ${bundle ?? '-'} | path: ${path ?? '-'}`,
  );

  return new Response(
    JSON.stringify({
      revalidated: true,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};

/**
 * GET /api/nodehive/revalidate?path=/es/
 *
 * Llamado por el script inline del layout cuando recibe 'reloadFrame'
 * antes de recargar. Mismo comportamiento que POST.
 */
export const GET: APIRoute = async ({ url }) => {
  const path = url.searchParams.get('path') ?? '/';
  console.log(`[NodeHive Revalidate] GET | path: ${path}`);

  return new Response(
    JSON.stringify({ revalidated: true, path, timestamp: new Date().toISOString() }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
