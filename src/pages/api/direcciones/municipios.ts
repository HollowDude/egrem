import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const GET: APIRoute = async () => {
  try {
    // El JSON maestro de Cuba vive en public/cuba.json (copiado de egrem_address/data/cuba.json)
    // y también en el módulo de Drupal. Lo servimos directamente sin pasar por NodeHive,
    // ya que la ruta /egrem_address/cuba.json no es pública en Drupal.
    const candidates = [
      join(process.cwd(), 'public/cuba.json'),
      join(process.cwd(), 'web/modules/custom/egrem_address/data/cuba.json'),
    ];

    let data: string | null = null;
    for (const p of candidates) {
      try {
        data = await readFile(p, 'utf-8');
        if (data) break;
      } catch {}
    }

    if (!data) {
      // Fallback: intenta fetch al backend por si se expone en el futuro
      const base = (process.env.NODEHIVE_BASE_URL || '').replace(/\/$/, '');
      if (base) {
        const res = await fetch(`${base}/egrem_address/cuba.json`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) data = await res.text();
      }
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'No se pudo cargar municipios.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/direcciones/municipios]', e);
    return new Response(JSON.stringify({ error: 'Error al cargar municipios.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
