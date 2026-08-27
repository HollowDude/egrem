/**
 * stock.ts — Stock multitienda para la Tienda EGREM.
 *
 * Fuente de datos real: endpoint Drupal `POST /{lang}/api/stock` (ver el plan).
 * Sin el flag STOCK_MULTITIENDA_REAL, se usa mockStock() para poder construir
 * el frontend en paralelo al backend (ver Fase 1 del plan).
 */

import { getApiKeyValue, getBaseUrlValue } from './client';
import type { ProductoTiendaStock } from '../../types/producto';
import type { TiendaInfo } from '../../types/tienda';

export interface StockItem {
  unlimited: boolean;
  total: number;
  byStore: Record<string, number>;
}

export interface StockResponse {
  stores: TiendaInfo[];
  items: Record<string, StockItem>;
}

const STOCK_MULTITIENDA_REAL = (() => {
  const v = process.env.STOCK_MULTITIENDA_REAL;
  return v === 'true' || v === '1';
})();

const STOCK_CACHE_TTL_MS = (() => {
  const v = Number(process.env.STOCK_CACHE_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : 30000;
})();

interface CacheEntry {
  at: number;
  data: StockResponse;
}

const cache = new Map<string, CacheEntry>();

function mockStores(): TiendaInfo[] {
  return [
    { id: '2', label: 'Egrem' },
    { id: '3', label: 'Tienda prueba' },
  ];
}

/**
 * Stock determinista por SKU para desarrollo sin backend real.
 * Varía el disponible para que se vean casos de agotado y con stock.
 */
export function mockStock(skus: string[]): StockResponse {
  const stores = mockStores();
  const items: Record<string, StockItem> = {};
  for (const sku of skus) {
    const base = [...sku].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const egrem = base % 7 === 0 ? 0 : (base % 5) + 1;
    const tiendaPrueba = (base + 1) % 3;
    items[sku] = {
      unlimited: false,
      total: egrem + tiendaPrueba,
      byStore: { '2': egrem, '3': tiendaPrueba },
    };
  }
  return { stores, items };
}

/**
 * Resuelve el stock de una variación a partir de la respuesta del endpoint:
 * - alwaysInStock → ilimitado en todas las tiendas.
 * - item.unlimited → ilimitado.
 * - si no hay item para el sku → agotado (degradación segura del merge).
 */
export function resolverStockTienda(
  sku: string,
  stockData: StockResponse,
  alwaysInStock: boolean,
): { stock: number | null; disponible: boolean; stockPorTienda: ProductoTiendaStock[] | null } {
  if (alwaysInStock) {
    const stockPorTienda = stockData.stores.map((tienda) => ({
      tienda,
      cantidad: null,
      ilimitado: true,
    }));
    return { stock: null, disponible: true, stockPorTienda };
  }

  const item = stockData.items[sku];
  if (!item) {
    return { stock: 0, disponible: false, stockPorTienda: null };
  }
  if (item.unlimited) {
    const stockPorTienda = stockData.stores.map((tienda) => ({
      tienda,
      cantidad: null,
      ilimitado: true,
    }));
    return { stock: null, disponible: true, stockPorTienda };
  }

  const stockPorTienda: ProductoTiendaStock[] = stockData.stores.map((tienda) => ({
    tienda,
    cantidad: item.byStore[tienda.id] ?? 0,
    ilimitado: false,
  }));
  const total =
    item.total ?? stockPorTienda.reduce((acc, s) => acc + (s.cantidad ?? 0), 0);
  return { stock: total, disponible: total > 0, stockPorTienda };
}

/** Tiendas que NO son físicas/selectables y se ocultan de la UI (case-insensitive). */
const TIENDAS_OCULTAS = new Set(['main']);

/** Quita las tiendas no selectables (p.ej. "Main") de stores/byStore y recalcula el total. */
export function ocultarNoTiendas(data: StockResponse): StockResponse {
  const visibles = data.stores.filter((s) => !TIENDAS_OCULTAS.has(s.label.toLowerCase()));
  const ids = new Set(visibles.map((s) => s.id));
  const items: Record<string, StockItem> = {};
  for (const [sku, it] of Object.entries(data.items)) {
    const byStore: Record<string, number> = {};
    for (const [id, q] of Object.entries(it.byStore)) {
      if (ids.has(id)) byStore[id] = q;
    }
    items[sku] = {
      ...it,
      byStore,
      total: it.unlimited ? it.total : Object.values(byStore).reduce((a, b) => a + b, 0),
    };
  }
  return { stores: visibles, items };
}

/**
 * Obtiene el stock multitienda de un lote de SKUs en una sola llamada.
 * En modo mock (flag apagado) devuelve datos deterministas de mockStock().
 * En caso de fallo real devuelve { stores: [], items: {} } (merge tolerante).
 */
export async function fetchStockPorTienda(
  skus: string[],
  lang = 'es',
  apiKey?: string,
  baseUrl?: string,
): Promise<StockResponse> {
  const uniq = [...new Set(skus.filter(Boolean))];
  if (uniq.length === 0) {
    return { stores: [], items: {} };
  }

  if (!STOCK_MULTITIENDA_REAL) {
    return ocultarNoTiendas(mockStock(uniq));
  }

  const key = `${lang}|${uniq.slice().sort().join(',')}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < STOCK_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${baseUrl || getBaseUrlValue()}/${lang}/api/stock`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Auth-Token': apiKey || getApiKeyValue() || '',
      },
      body: JSON.stringify({ skus: uniq }),
    });
    if (!res.ok) {
      return { stores: [], items: {} };
    }
    const data = (await res.json()) as StockResponse;
    const clean = ocultarNoTiendas(data);
    cache.set(key, { at: Date.now(), data: clean });
    return clean;
  } catch {
    return { stores: [], items: {} };
  }
}
