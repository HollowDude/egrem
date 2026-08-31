import type { JsonApiResource, JsonApiRelationship, JsonApiResourceIdentifier } from './client';

export function findIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
  id: string,
): JsonApiResource | undefined {
  return included?.find((r) => r.type === type && r.id === id);
}

export function findAllIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
): JsonApiResource[] {
  return included?.filter((r) => r.type === type) ?? [];
}

export function resolveRelIds(rel: JsonApiRelationship | undefined): JsonApiResourceIdentifier[] {
  if (!rel?.data) return [];
  return Array.isArray(rel.data) ? rel.data : [rel.data];
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function estimateReadingTime(body: string): number {
  const text = stripHtml(body);
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Etiqueta mostrada para taxonomías/tipo_de_evento.
 * Drupal sigue enviando "Local" (slug "local"), pero en el front
 * se muestra "Locación" (redefinición solicitada).
 * Añade aquí otros mapeos si aparecen (ej. "local" -> "Locación").
 */
export function displayTag(label: string): string {
  if (!label) return label;
  if (label.trim().toLowerCase() === 'local') return 'Locación';
  return label;
}
