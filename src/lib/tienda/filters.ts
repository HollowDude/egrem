/**
 * Filtros de la tienda (solo categoría Entradas por ahora).
 * Funciones puras: reciben NhEventoListItem[] + parámetros y devuelven el array filtrado.
 * Mismas convenciones que eventos.astro / EventoFilterBar (SSR vía query params, slugify).
 */

import { slugify } from '@/lib/nodehive/helpers';
import type { NhEventoListItem } from '@/lib/nodehive/eventos';

export interface TiendaFilters {
  tipo: string;
  sede: string;
  precioMin?: string;
  precioMax?: string;
  disponibilidad: string;
  q: string;
}

export type TiendaSort = 'proximos' | 'precio-asc' | 'precio-desc';

export function filterByTipo(items: NhEventoListItem[], tipo: string): NhEventoListItem[] {
  if (!tipo) return items;
  return items.filter((e) => slugify(e.categoria) === tipo);
}

export function filterBySede(items: NhEventoListItem[], sede: string): NhEventoListItem[] {
  if (!sede) return items;
  return items.filter((e) => slugify(e.lugarTexto) === sede);
}

export function filterByPrecio(
  items: NhEventoListItem[],
  precioMin?: number,
  precioMax?: number,
): NhEventoListItem[] {
  if (precioMin === undefined && precioMax === undefined) return items;
  return items.filter((e) => {
    const p = e.precioDesde;
    if (p === null) return false;
    if (precioMin !== undefined && p < precioMin) return false;
    if (precioMax !== undefined && p > precioMax) return false;
    return true;
  });
}

export function filterByDisponibilidad(
  items: NhEventoListItem[],
  disponibilidad: string,
): NhEventoListItem[] {
  if (disponibilidad === 'agotados') return items.filter((e) => e.agotado);
  if (disponibilidad === 'disponibles') return items.filter((e) => !e.agotado);
  return items;
}

export function filterByQuery(items: NhEventoListItem[], q: string): NhEventoListItem[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return items;
  return items.filter(
    (e) =>
      e.title.toLowerCase().includes(ql) || e.artistas.some((a) => a.toLowerCase().includes(ql)),
  );
}

export function sortItems(
  items: NhEventoListItem[],
  sort: TiendaSort = 'proximos',
): NhEventoListItem[] {
  const copy = [...items];
  switch (sort) {
    case 'precio-asc':
      return copy.sort((a, b) => (a.precioDesde ?? Infinity) - (b.precioDesde ?? Infinity));
    case 'precio-desc':
      return copy.sort((a, b) => (b.precioDesde ?? -Infinity) - (a.precioDesde ?? -Infinity));
    case 'proximos':
    default:
      return copy.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  }
}

export function paginate(
  items: NhEventoListItem[],
  page: number,
  perPage = 9,
): { items: NhEventoListItem[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return { items: items.slice(start, start + perPage), totalPages };
}

export function applyFilters(
  items: NhEventoListItem[],
  filters: TiendaFilters,
  sort: TiendaSort = 'proximos',
): NhEventoListItem[] {
  const precioMin =
    filters.precioMin && filters.precioMin !== '' ? Number(filters.precioMin) : undefined;
  const precioMax =
    filters.precioMax && filters.precioMax !== '' ? Number(filters.precioMax) : undefined;
  return sortItems(
    filterByQuery(
      filterByDisponibilidad(
        filterByPrecio(
          filterBySede(filterByTipo(items, filters.tipo), filters.sede),
          Number.isFinite(precioMin) ? precioMin : undefined,
          Number.isFinite(precioMax) ? precioMax : undefined,
        ),
        filters.disponibilidad,
      ),
      filters.q,
    ),
    sort,
  );
}
