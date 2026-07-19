/**
 * Fetchers para contenido específico del homepage.
 *
 * Cada función sigue el patrón: client → helpers → parsers → tipo limpio.
 *
 * TODO(nodehive): confirmar los bundle machine names y endpoints JSON:API
 * cuando el backend Drupal exponga estos endpoints. Por ahora las funciones
 * devuelven arrays vacíos con un console.warn para no romper el build.
 */

import type {
  NhNoticia,
  NhAlbum,
  NhEvento,
  NhVideo,
  NhProduccion,
  NhVideoLink,
  NhAlbumLink,
} from './entities';
import { resolveVideoLink } from './youtube';
import { resolveSpotifyLink } from './spotify';

/* ─── Noticias ─────────────────────────────────────────────────── */

// TODO(nodehive): implementar fetch real cuando exista endpoint
//   node/noticia?include=field_image,field_image.field_media_image&sort=-created&page[limit]=3
export async function fetchNoticias(_lang = 'es'): Promise<NhNoticia[]> {
  console.warn('[NodeHive] fetchNoticias: pendiente de implementar endpoint');
  return [];
}

/* ─── Lanzamientos (álbumes) ───────────────────────────────────── */

export async function fetchLanzamientos(albumLinks: NhAlbumLink[]): Promise<NhAlbum[]> {
  if (!albumLinks.length) return [];

  const results = await Promise.allSettled(
    albumLinks.map(async (al) => {
      const resolved = await resolveSpotifyLink(al.title, al.url);
      return {
        id: al.id,
        title: resolved.title,
        cover: resolved.cover,
        href: al.url,
        spotifyId: resolved.spotifyId,
        embedUrl: resolved.embedUrl,
        internalId: al.internalId,
        parentId: al.parentId,
        bundle: al.bundle,
      } satisfies NhAlbum;
    }),
  );

  const albums: NhAlbum[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') albums.push(r.value);
    else console.warn('[NodeHive] Failed to resolve album link:', r.reason);
  }
  return albums;
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

export async function fetchVideos(videoLinks: NhVideoLink[]): Promise<NhVideo[]> {
  if (!videoLinks.length) return [];

  const results = await Promise.allSettled(
    videoLinks.map(async (vl) => {
      const resolved = await resolveVideoLink(vl.title, vl.url);
      return {
        id: vl.id,
        title: resolved.title,
        youtubeId: resolved.youtubeId,
        thumbnail: resolved.thumbnail,
        href: vl.url,
        internalId: vl.internalId,
        parentId: vl.parentId,
        bundle: vl.bundle,
      } satisfies NhVideo;
    }),
  );

  const videos: NhVideo[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') videos.push(r.value);
    else console.warn('[NodeHive] Failed to resolve video link:', r.reason);
  }
  return videos;
}
