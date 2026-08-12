import { describe, it, expect } from 'vitest';
import {
  filterByTipo,
  filterBySede,
  filterByPrecio,
  filterByDisponibilidad,
  filterByQuery,
  sortItems,
  paginate,
  applyFilters,
  type TiendaFilters,
} from '../filters';
import type { NhEventoListItem } from '@/lib/nodehive/eventos';

function makeEvento(overrides: Partial<NhEventoListItem>): NhEventoListItem {
  return {
    id: 'x',
    internalId: 0,
    parentId: '',
    bundle: 'evento',
    title: 'Evento',
    href: '/evento/1',
    thumbnail: null,
    fechaInicio: '2026-10-14',
    fechaFin: '2026-10-14',
    lugarTexto: 'Club Habana',
    categoria: 'Festival',
    esInternacional: false,
    descripcionCorta: '',
    precioDesde: 25,
    agotado: false,
    artistas: [],
    ...overrides,
  };
}

const ITEMS = [
  makeEvento({
    id: '1',
    title: 'Festival Jazz',
    categoria: 'Festival',
    lugarTexto: 'Club Habana',
    precioDesde: 25,
    agotado: false,
    fechaInicio: '2026-10-14',
    artistas: ['Los Van Van'],
  }),
  makeEvento({
    id: '2',
    title: 'Concierto Rock',
    categoria: 'Concierto',
    lugarTexto: 'Teatro América',
    precioDesde: 50,
    agotado: true,
    fechaInicio: '2026-09-01',
    artistas: [],
  }),
  makeEvento({
    id: '3',
    title: 'Gala Ballet',
    categoria: 'Gala',
    lugarTexto: 'Club Habana',
    precioDesde: null,
    agotado: false,
    fechaInicio: '2026-11-30',
    artistas: ['Alicia Alonso'],
  }),
];

describe('filterByTipo', () => {
  it('returns all when tipo is empty', () => {
    expect(filterByTipo(ITEMS, '')).toHaveLength(3);
  });
  it('matches by slugified categoria', () => {
    expect(filterByTipo(ITEMS, 'festival').map((e) => e.id)).toEqual(['1']);
    expect(filterByTipo(ITEMS, 'concierto').map((e) => e.id)).toEqual(['2']);
  });
});

describe('filterBySede', () => {
  it('returns all when sede is empty', () => {
    expect(filterBySede(ITEMS, '')).toHaveLength(3);
  });
  it('matches by slugified lugarTexto', () => {
    expect(filterBySede(ITEMS, 'club-habana').map((e) => e.id)).toEqual(['1', '3']);
    expect(filterBySede(ITEMS, 'teatro-america').map((e) => e.id)).toEqual(['2']);
  });
});

describe('filterByPrecio', () => {
  it('returns all when no bounds', () => {
    expect(filterByPrecio(ITEMS)).toHaveLength(3);
  });
  it('filters by min', () => {
    expect(filterByPrecio(ITEMS, 30).map((e) => e.id)).toEqual(['2']);
  });
  it('filters by max', () => {
    expect(filterByPrecio(ITEMS, undefined, 25).map((e) => e.id)).toEqual(['1']);
  });
  it('filters by min and max', () => {
    expect(filterByPrecio(ITEMS, 20, 40).map((e) => e.id)).toEqual(['1']);
  });
  it('excludes items with null precioDesde', () => {
    expect(filterByPrecio(ITEMS, 0).map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('filterByDisponibilidad', () => {
  it('returns all when empty', () => {
    expect(filterByDisponibilidad(ITEMS, '')).toHaveLength(3);
  });
  it('keeps only sold out', () => {
    expect(filterByDisponibilidad(ITEMS, 'agotados').map((e) => e.id)).toEqual(['2']);
  });
  it('keeps only available', () => {
    expect(filterByDisponibilidad(ITEMS, 'disponibles').map((e) => e.id)).toEqual(['1', '3']);
  });
});

describe('filterByQuery', () => {
  it('returns all when query is empty', () => {
    expect(filterByQuery(ITEMS, '')).toHaveLength(3);
  });
  it('matches title case-insensitively', () => {
    expect(filterByQuery(ITEMS, 'ballet').map((e) => e.id)).toEqual(['3']);
  });
  it('matches artist name', () => {
    expect(filterByQuery(ITEMS, 'los van van').map((e) => e.id)).toEqual(['1']);
  });
  it('returns empty when no match', () => {
    expect(filterByQuery(ITEMS, 'zzz')).toHaveLength(0);
  });
});

describe('sortItems', () => {
  it('proximos: ascending by fechaInicio', () => {
    expect(sortItems(ITEMS, 'proximos').map((e) => e.id)).toEqual(['2', '1', '3']);
  });
  it('precio-asc (null precioDesde goes last)', () => {
    expect(sortItems(ITEMS, 'precio-asc').map((e) => e.id)).toEqual(['1', '2', '3']);
  });
  it('precio-desc', () => {
    expect(sortItems(ITEMS, 'precio-desc').map((e) => e.id)).toEqual(['2', '1', '3']);
  });
  it('does not mutate the input', () => {
    const copy = [...ITEMS];
    sortItems(ITEMS, 'precio-desc');
    expect(ITEMS).toEqual(copy);
  });
});

describe('paginate', () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    makeEvento({ id: String(i), fechaInicio: `2026-0${(i % 9) + 1}-01` }),
  );
  it('computes totalPages', () => {
    expect(paginate(many, 1, 9).totalPages).toBe(3);
  });
  it('slices the current page', () => {
    const { items, totalPages } = paginate(many, 2, 9);
    expect(totalPages).toBe(3);
    expect(items).toHaveLength(9);
  });
  it('clamps out-of-range pages', () => {
    const { items } = paginate(many, 99, 9);
    expect(items).toHaveLength(7);
  });
  it('at least one page', () => {
    expect(paginate([], 1, 9).totalPages).toBe(1);
  });
});

describe('applyFilters', () => {
  const base: TiendaFilters = {
    tipo: '',
    sede: '',
    precioMin: '',
    precioMax: '',
    disponibilidad: '',
    q: '',
  };

  it('returns all for empty filters', () => {
    expect(applyFilters(ITEMS, base)).toHaveLength(3);
  });
  it('composes tipo + sede', () => {
    expect(
      applyFilters(ITEMS, { ...base, tipo: 'festival', sede: 'club-habana' }).map((e) => e.id),
    ).toEqual(['1']);
  });
  it('composes disponibilidad + query', () => {
    expect(
      applyFilters(ITEMS, { ...base, disponibilidad: 'disponibles', q: 'los van van' }).map(
        (e) => e.id,
      ),
    ).toEqual(['1']);
  });
  it('applies price bounds from string filters', () => {
    expect(
      applyFilters(ITEMS, { ...base, precioMin: '30', precioMax: '60' }).map((e) => e.id),
    ).toEqual(['2']);
  });
  it('sorts the result', () => {
    expect(applyFilters(ITEMS, base, 'precio-desc').map((e) => e.id)).toEqual(['2', '1', '3']);
  });
});
