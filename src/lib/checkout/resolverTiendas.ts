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

/**
 * Normaliza una etiqueta de tienda para comparar: minúsculas, sin espacios
 * extra y sin el prefijo "Stock " que usa /api/stores
 * (p. ej. "Stock Tienda prueba" → "tienda prueba").
 */
export function normalizarEtiquetaTienda(label: string | null | undefined): string {
  return (label ?? '')
    .toLowerCase()
    .trim()
    .replace(/^stock\s+/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Resuelve la TiendaInfo de una orden probando en orden:
 * 1. coincidencia exacta por id (uuid de /api/stores),
 * 2. coincidencia por etiqueta normalizada (el pedido trae store_id
 *    numérico de Drupal que no existe en /api/stores).
 * Devuelve null si no hay forma fiable de resolverla (nunca una tienda ajena).
 */
export function buscarTiendaParaOrden(
  tiendas: TiendaInfo[],
  storeId?: string | number | null,
  storeLabel?: string | null,
): TiendaInfo | null {
  const id = storeId != null ? String(storeId).trim() : '';
  if (id) {
    const porId = tiendas.find((t) => String(t.id).trim() === id);
    if (porId) return porId;
  }
  const etiqueta = normalizarEtiquetaTienda(storeLabel);
  if (etiqueta) {
    const porEtiqueta = tiendas.find((t) => normalizarEtiquetaTienda(t.label) === etiqueta);
    if (porEtiqueta) return porEtiqueta;
  }
  return null;
}
