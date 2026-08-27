import { describe, it, expect } from 'vitest';
import {
  resolverStockTienda,
  mockStock,
  fetchStockPorTienda,
  ocultarNoTiendas,
  type StockResponse,
} from './stock';
import type { TiendaInfo } from '../../types/tienda';

const stores: TiendaInfo[] = [
  { id: '2', label: 'Egrem' },
  { id: '3', label: 'Tienda prueba' },
];

describe('resolverStockTienda', () => {
  it('always_in_stock -> ilimitado en todas las tiendas', () => {
    const data: StockResponse = { stores, items: {} };
    const r = resolverStockTienda('X', data, true);
    expect(r.stock).toBeNull();
    expect(r.disponible).toBe(true);
    expect(r.stockPorTienda).toHaveLength(2);
    expect(r.stockPorTienda?.every((s) => s.ilimitado)).toBe(true);
  });

  it('item presente con stock agregado', () => {
    const data: StockResponse = {
      stores,
      items: { SKU1: { unlimited: false, total: 5, byStore: { '2': 3, '3': 2 } } },
    };
    const r = resolverStockTienda('SKU1', data, false);
    expect(r.stock).toBe(5);
    expect(r.disponible).toBe(true);
    expect(r.stockPorTienda).toEqual([
      { tienda: stores[0], cantidad: 3, ilimitado: false },
      { tienda: stores[1], cantidad: 2, ilimitado: false },
    ]);
  });

  it('item ausente -> degradación a agotado (seguro)', () => {
    const data: StockResponse = { stores, items: {} };
    const r = resolverStockTienda('NOPE', data, false);
    expect(r.stock).toBe(0);
    expect(r.disponible).toBe(false);
    expect(r.stockPorTienda).toBeNull();
  });

  it('item.unlimited -> ilimitado', () => {
    const data: StockResponse = {
      stores,
      items: { SKU2: { unlimited: true, total: 999, byStore: {} } },
    };
    const r = resolverStockTienda('SKU2', data, false);
    expect(r.stock).toBeNull();
    expect(r.disponible).toBe(true);
    expect(r.stockPorTienda?.every((s) => s.ilimitado)).toBe(true);
  });
});

describe('mockStock', () => {
  it('devuelve stores y un item por sku', () => {
    const data = mockStock(['A', 'B']);
    expect(data.stores).toHaveLength(2);
    expect(Object.keys(data.items)).toEqual(['A', 'B']);
    for (const item of Object.values(data.items)) {
      expect(item.total).toBe(item.byStore['2'] + item.byStore['3']);
    }
  });

  it('es determinista', () => {
    expect(mockStock(['A'])).toEqual(mockStock(['A']));
  });
});

describe('fetchStockPorTienda (modo mock / flag apagado)', () => {
  it('skus vacíos -> respuesta vacía', async () => {
    const data = await fetchStockPorTienda([], 'es');
    expect(data).toEqual({ stores: [], items: {} });
  });

  it('usa mockStock sin llamar a red', async () => {
    const data = await fetchStockPorTienda(['A', 'B'], 'es');
    expect(data.stores.length).toBe(2);
    expect(Object.keys(data.items).length).toBe(2);
  });
});

describe('ocultarNoTiendas', () => {
  const main: TiendaInfo = { id: 'm', label: 'Main' };
  const egrem: TiendaInfo = { id: 'e', label: 'Stock Egrem' };
  const tp: TiendaInfo = { id: 't', label: 'Stock Tienda prueba' };

  it('quita Main de stores y recalcula el total como suma de tiendas visibles', () => {
    const data: StockResponse = {
      stores: [main, egrem, tp],
      items: {
        X: { unlimited: false, total: 11, byStore: { m: 11, e: 0, t: 0 } },
      },
    };
    const r = ocultarNoTiendas(data);
    expect(r.stores.map((s) => s.label)).toEqual(['Stock Egrem', 'Stock Tienda prueba']);
    expect(r.items.X.byStore).toEqual({ e: 0, t: 0 });
    expect(r.items.X.total).toBe(0);
  });

  it('mantiene el total de items unlimited', () => {
    const data: StockResponse = {
      stores: [main, egrem],
      items: {
        Y: { unlimited: true, total: 99, byStore: { m: 99, e: 0 } },
      },
    };
    const r = ocultarNoTiendas(data);
    expect(r.stores.map((s) => s.label)).toEqual(['Stock Egrem']);
    expect(r.items.Y.total).toBe(99);
  });

  it('es case-insensitive y no afecta stores sin Main', () => {
    const data: StockResponse = {
      stores: [egrem, tp],
      items: { Z: { unlimited: false, total: 5, byStore: { e: 3, t: 2 } } },
    };
    const r = ocultarNoTiendas(data);
    expect(r.stores).toHaveLength(2);
    expect(r.items.Z.total).toBe(5);
  });
});
