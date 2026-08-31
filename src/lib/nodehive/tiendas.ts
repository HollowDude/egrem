/**
 * tiendas.ts — Catálogo de tiendas físicas con dirección geográfica.
 *
 * Fuente: endpoint Drupal `GET /{lang}/api/stores` (ver plan de
 * filtro geográfico).
 *
 * El `id` de cada tienda es el MISMO uuid que usa `/api/stock` (`stores[].id`) y
 * que se manda como `store_id` al carrito — un solo identificador cruza los tres
 * contratos, sin ambigüedad de mapeo.
 */

import { getApiKeyValue, getBaseUrlValue } from './client';
import type { TiendaInfo } from '../../types/tienda';

// La dirección casi no cambia: 24h de cache en cliente/servidor.
const TIENDAS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cache: { at: number; data: TiendaInfo[] } | null = null;

function mockTiendas(): TiendaInfo[] {
  return [
    {
      id: '2',
      label: 'Egrem',
      provincia: 'La Habana',
      municipio: 'Playa',
      direccion: 'Calle 23 #456, Playa, La Habana',
    },
    {
      id: '3',
      label: 'Tienda prueba',
      provincia: 'La Habana',
      municipio: 'Centro Habana',
      direccion: 'Calle Neptuno #123, Centro Habana',
    },
  ];
}

/**
 * Catálogo de tiendas con dirección. Cacheable 24h. En caso de fallo real
 * devuelve el cache previo si existe (degradación: mejor lo viejo que nada);
 * si nunca hubo cache, devuelve `[]`.
 */
export async function fetchTiendas(lang = 'es'): Promise<TiendaInfo[]> {
  if (cache && Date.now() - cache.at < TIENDAS_CACHE_TTL_MS) return cache.data;
  try {
    const res = await fetch(`${getBaseUrlValue()}/${lang}/api/stores`, {
      headers: {
        Accept: 'application/json',
        'X-Auth-Token': getApiKeyValue() || '',
      },
    });
    if (!res.ok) return cache?.data ?? [];
    const raw = (await res.json()) as { stores: (TiendaInfo & { ciudad?: string })[] };
    // Compatibilidad: antes el endpoint devolvía `ciudad`, ahora `municipio`
    const stores: TiendaInfo[] = raw.stores.map((s) => ({
      ...s,
      municipio: s.municipio ?? s.ciudad ?? '',
    }));
    cache = { at: Date.now(), data: stores };
    return stores;
  } catch {
    return cache?.data ?? [];
  }
}

/** Agrupa provincia → municipios, solo con tiendas activas (para el popup). */
export function agruparPorProvincia(tiendas: TiendaInfo[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const t of tiendas) {
    if (!t.provincia || !t.municipio) continue;
    (map[t.provincia] ??= new Set()).add(t.municipio);
  }
  return Object.fromEntries(
    Object.entries(map).map(([p, ms]) => [p, [...ms].sort()]),
  );
}
