import { describe, it, expect } from 'vitest';
import {
  parseMunicipiosCookie,
  resolverTiendasPermitidas,
} from './ubicacion';
import type { TiendaInfo } from '../../types/tienda';

describe('parseMunicipiosCookie', () => {
  it('vuelve [] si no hay cookie', () => {
    expect(parseMunicipiosCookie(undefined)).toEqual([]);
  });
  it('vuelve [] si el JSON está roto', () => {
    expect(parseMunicipiosCookie('no-json')).toEqual([]);
  });
  it('vuelve [] si no es un array', () => {
    expect(parseMunicipiosCookie('{"a":1}')).toEqual([]);
  });
  it('parsea un array válido de municipios', () => {
    const raw = JSON.stringify([{ provincia: 'La Habana', municipio: 'Plaza' }]);
    expect(parseMunicipiosCookie(raw)).toEqual([{ provincia: 'La Habana', municipio: 'Plaza' }]);
  });
});

describe('resolverTiendasPermitidas', () => {
  const catalogo: TiendaInfo[] = [
    { id: '1', label: 'A', provincia: 'La Habana', municipio: 'Plaza' },
    { id: '2', label: 'B', provincia: 'La Habana', municipio: 'Centro' },
    { id: '3', label: 'C', provincia: 'Artemisa', municipio: 'Plaza' },
    { id: '4', label: 'D' },
  ];

  it('selección vacía -> conjunto vacío (sin filtro geográfico)', () => {
    expect(resolverTiendasPermitidas([], catalogo).size).toBe(0);
  });

  it('filtra por provincia + municipio', () => {
    const r = resolverTiendasPermitidas([{ provincia: 'La Habana', municipio: 'Plaza' }], catalogo);
    expect([...r]).toEqual(['1']);
  });

  it('ignora tiendas sin provincia/municipio', () => {
    const r = resolverTiendasPermitidas([{ provincia: 'La Habana', municipio: 'Centro' }], catalogo);
    expect([...r]).toEqual(['2']);
  });

  it('admite múltiples municipios seleccionados', () => {
    const r = resolverTiendasPermitidas(
      [
        { provincia: 'La Habana', municipio: 'Plaza' },
        { provincia: 'Artemisa', municipio: 'Plaza' },
      ],
      catalogo,
    );
    expect([...r].sort()).toEqual(['1', '3']);
  });
});
