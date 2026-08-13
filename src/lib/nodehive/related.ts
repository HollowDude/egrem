import type { NhActualidadItem } from './entities';

export function getRelatedItems(
  current: NhActualidadItem,
  all: NhActualidadItem[],
  limit = 3,
): NhActualidadItem[] {
  const currentTags = new Set(current.tags.map((t) => t.slug));
  const withTags = all
    .filter((i) => i.id !== current.id && i.tags.some((t) => currentTags.has(t.slug)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  if (withTags.length > 0) return withTags;

  return all
    .filter((i) => i.id !== current.id && i.bundle === current.bundle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/**
 * Contenido relacionado del detalle: usa el curado en Drupal
 * (field_articulos_relacionados) y, si no hay, cae al cálculo actual.
 */
export function resolveRelated(
  current: NhActualidadItem,
  all: NhActualidadItem[],
  limit = 3,
): NhActualidadItem[] {
  if (current.relatedContent && current.relatedContent.length > 0) {
    return current.relatedContent;
  }
  return getRelatedItems(current, all, limit);
}
