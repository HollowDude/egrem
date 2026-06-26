/**
 * Fetchers para contenido específico del homepage.
 *
 * Cada función sigue el patrón: client → helpers → parsers → tipo limpio.
 *
 * TODO(nodehive): confirmar los bundle machine names y endpoints JSON:API
 * cuando el backend Drupal exponga estos endpoints. Por ahora las funciones
 * devuelven arrays vacíos con un console.warn para no romper el build.
 */

import type { NhNoticia, NhAlbum, NhEvento, NhVideo, NhProduccion } from '@/types/drupal';

/* ─── Noticias ─────────────────────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/noticia?include=field_image,field_image.field_media_image&sort=-created&page[limit]=3
export async function fetchNoticias(_lang = 'es'): Promise<NhNoticia[]> {
  console.warn('[NodeHive] fetchNoticias: pendiente de implementar endpoint');
  return [];
}

/* ─── Lanzamientos (álbumes) ───────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/album?include=field_cover,field_cover.field_media_image&sort=-created&page[limit]=4
export async function fetchLanzamientos(_lang = 'es'): Promise<NhAlbum[]> {
  console.warn('[NodeHive] fetchLanzamientos: pendiente de implementar endpoint');
  return [];
}

/* ─── Eventos ──────────────────────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/evento?include=&sort=field_date&page[limit]=3
export async function fetchEventos(_lang = 'es'): Promise<NhEvento[]> {
  console.warn('[NodeHive] fetchEventos: pendiente de implementar endpoint');
  return [];
}

/* ─── Producciones ─────────────────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/produccion?include=field_image,field_image.field_media_image&sort=-created&page[limit]=5
export async function fetchProducciones(_lang = 'es'): Promise<NhProduccion[]> {
  console.warn('[NodeHive] fetchProducciones: pendiente de implementar endpoint');
  return [];
}

/* ─── Videos ───────────────────────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/video?include=field_thumbnail,field_thumbnail.field_media_image&sort=-created&page[limit]=3
export async function fetchVideos(_lang = 'es'): Promise<NhVideo[]> {
  console.warn('[NodeHive] fetchVideos: pendiente de implementar endpoint');
  return [];
}
