import { describe, it, expect } from 'vitest';
import { agruparPorProvincia } from './tiendas';
import type { TiendaInfo } from '../../types/tienda';

describe('agruparPorProvincia', () => {
  const tiendas: TiendaInfo[] = [
    { id: '1', label: 'A', provincia: 'La Habana', municipio: 'Plaza' },
    { id: '2', label: 'B', provincia: 'La Habana', municipio: 'Centro' },
    { id: '3', label: 'C', provincia: 'Artemisa', municipio: 'Plaza' },
    { id: '4', label: 'D' },
  ];

  it('agrupa municipios por provincia ordenados', () => {
    const r = agruparPorProvincia(tiendas);
    expect(r['La Habana']).toEqual(['Centro', 'Plaza']);
    expect(r['Artemisa']).toEqual(['Plaza']);
  });

  it('omite tiendas sin provincia/municipio', () => {
    const r = agruparPorProvincia(tiendas);
    expect(Object.values(r).flat()).not.toContain(undefined);
    expect(Object.keys(r)).toEqual(['La Habana', 'Artemisa']);
  });

  it('devuelve objeto vacío si no hay nada que agrupar', () => {
    expect(agruparPorProvincia([])).toEqual({});
    expect(agruparPorProvincia([{ id: 'x', label: 'X' }])).toEqual({});
  });
});
