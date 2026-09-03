import { fetchTiendas } from '@/lib/nodehive/tiendas';
import type { TiendaInfo } from '@/types/tienda';

export async function resolverDireccionesTienda(
  summary: Record<string, unknown> | null,
  lang: string = 'es',
): Promise<Map<string, TiendaInfo>> {
  const tiendas = await fetchTiendas(lang);
  const map = new Map<string, TiendaInfo>();
  for (const t of tiendas) map.set(String(t.id), t);
  return map;
}

export function getTiendaForOrder(
  storeId: string | number,
  tiendas: Map<string, TiendaInfo>,
): TiendaInfo | undefined {
  return tiendas.get(String(storeId));
}
