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
  NhAlbum,
  NhEvento,
  NhVideo,
  NhProduccion,
  NhVideoLink,
  NhAlbumLink,
  NhEventoLink,
} from './entities';
import type { JsonApiResource, JsonApiRelationship, JsonApiResourceIdentifier } from './client';
import type { NhMediaImage } from './parsers';
import { resolveVideoLink } from './youtube';
import { resolveSpotifyLink, extractSpotifyId } from './spotify';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl, normalizeDrupalUri } from './parsers';
import { buildEmbedUrl, detectPlatform } from './music-embed';

/* ─── Lanzamientos (álbumes) ───────────────────────────────────── */

const ALBUM_INCLUDES =
  'field_imagen_portada,field_imagen_portada.field_media_image,field_artista,field_external_apps';

interface AlbumLanzamientoData {
  title: string;
  artist: string;
  cover: NhMediaImage | null;
  href: string;
  nid: number;
  spotifyId: string | null;
  embedUrl: string;
  externalApp: { title: string; url: string; platform: string } | null;
}

function parseAlbumLanzamiento(
  resource: JsonApiResource,
  included: JsonApiResource[],
): AlbumLanzamientoData {
  const a = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  const nid = (a.drupal_internal__nid as number) ?? 0;
  const href =
    (a.path as { alias?: string | null } | undefined)?.alias ?? `/catalogo/musica/${nid}`;

  let artist = '';
  const artistaRel = rels?.field_artista?.data as JsonApiResourceIdentifier | undefined;
  if (artistaRel) {
    const artista = findIncluded(included, 'node--artista', artistaRel.id);
    artist = ((artista?.attributes as Record<string, unknown> | undefined)?.title as string) ?? '';
  }

  let cover: NhMediaImage | null = null;
  const portadaRel = rels?.field_imagen_portada?.data as JsonApiResourceIdentifier | undefined;
  if (portadaRel) {
    const media = findIncluded(included, 'media--image', portadaRel.id);
    if (media) {
      cover = parseMediaImage(media, included);
      if (cover?.url) cover.url = resolveFileUrl(cover.url);
    }
  }

  let spotifyId: string | null = null;
  let embedUrl = '';
  let externalApp: AlbumLanzamientoData['externalApp'] = null;
  for (const ref of resolveRelIds(rels?.field_external_apps)) {
    const p = findIncluded(included, 'paragraph--external_apps', ref.id);
    const pa = p?.attributes as Record<string, unknown> | undefined;
    const link = pa?.field_app_link as { uri?: string; title?: string } | undefined;
    const url = link?.uri ? normalizeDrupalUri(link.uri) : '';
    if (!url) continue;
    const platform = detectPlatform(url);
    const titulo = (pa?.field_titulo as string) ?? '';
    if (platform === 'spotify') {
      spotifyId = extractSpotifyId(url)?.id ?? null;
      embedUrl = buildEmbedUrl(url) ?? '';
    } else if (platform === 'apple_music' && !externalApp) {
      externalApp = { title: titulo, url, platform };
    }
  }

  return {
    title: (a.title as string) ?? '',
    artist,
    cover,
    href,
    nid,
    spotifyId,
    embedUrl,
    externalApp,
  };
}

async function fetchAlbumLanzamiento(
  uuid: string,
  lang: string,
): Promise<AlbumLanzamientoData | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album/${uuid}?include=${ALBUM_INCLUDES}`,
      lang,
    );
    if (!res.data) return null;
    return parseAlbumLanzamiento(res.data as JsonApiResource, res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumLanzamiento failed:', e);
    return null;
  }
}

async function fetchUltimosLanzamientos(lang: string): Promise<AlbumLanzamientoData[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?sort=-created&page[limit]=4&include=${ALBUM_INCLUDES}`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return data.map((r) => parseAlbumLanzamiento(r as JsonApiResource, res.included ?? []));
  } catch (e) {
    console.warn('[NodeHive] fetchUltimosLanzamientos failed:', e);
    return [];
  }
}

export async function fetchLanzamientos(
  albumLinks: NhAlbumLink[],
  lang = 'es',
): Promise<NhAlbum[]> {
  const resolvable = albumLinks.filter((al) => al.bundle === 'album' || al.url);
  if (!resolvable.length) {
    const ultimos = await fetchUltimosLanzamientos(lang);
    return ultimos.map((u) => ({
      id: `album-${u.nid}`,
      internalId: u.nid,
      parentId: '',
      bundle: 'album',
      ...u,
    }));
  }

  const results = await Promise.allSettled(
    resolvable.map(async (al) => {
      if (al.bundle === 'album') {
        const album = await fetchAlbumLanzamiento(al.id, lang);
        if (!album) return null;
        return {
          id: al.id,
          internalId: album.nid,
          parentId: al.parentId,
          bundle: 'album',
          ...album,
        } satisfies NhAlbum;
      }
      // Legacy: paragraph homepage_lanzamiento_spotify con link a Spotify
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
    if (r.status === 'fulfilled' && r.value) albums.push(r.value);
    else if (r.status === 'rejected')
      console.warn('[NodeHive] Failed to resolve album link:', r.reason);
  }
  return albums;
}

/* ─── Eventos ──────────────────────────────────────────────────── */

function parseEventoHome(resource: JsonApiResource): NhEvento {
  const a = resource.attributes as Record<string, unknown>;
  const path = a.path as { alias?: string } | undefined;
  const fieldFecha = a.field_fecha as string | { value?: string; end_value?: string } | undefined;
  const startDate = typeof fieldFecha === 'string' ? fieldFecha : fieldFecha?.value;
  const endDate = typeof fieldFecha === 'object' && fieldFecha !== null ? fieldFecha.end_value : undefined;
  const fieldHora = a.field_hora as string | undefined;
  const fieldLugar = a.field_lugar as string | undefined;
  return {
    id: resource.id,
    title: (a.title as string) ?? '',
    venue: (fieldLugar as string) ?? '',
    date: startDate ?? '',
    endDate,
    time: fieldHora ?? '',
    href: path?.alias ?? `/evento/${a.drupal_internal__nid}`,
  } satisfies NhEvento;
}

async function fetchEventoHomeByUuid(uuid: string, lang: string): Promise<NhEvento | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(`node/evento/${uuid}`, lang);
    if (!res.data) return null;
    return parseEventoHome(res.data as JsonApiResource);
  } catch (e) {
    console.warn('[NodeHive] fetchEventoHomeByUuid failed:', e);
    return null;
  }
}

async function fetchEventosFromDrupal(lang = 'es'): Promise<NhEvento[]> {
  try {
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate(),
    ).padStart(2, '0')}`;
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/evento?filter[field_fecha.end_value][value]=${hoyStr}&filter[field_fecha.end_value][operator]=%3E%3D&sort=field_fecha.value&page[limit]=20`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];

    // Descartar eventos sin field_fecha (null): la fecha es la base de las mini-cards
    // y caer a `created` producía fechas inválidas en el renderizado.
    return data
      .map((r) => parseEventoHome(r as JsonApiResource))
      .filter((e) => e.date)
      .slice(0, 5);
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) {
      console.debug('[NodeHive] fetchEventos: endpoint node/evento not available on Drupal');
    } else {
      console.warn('[NodeHive] fetchEventos: fallback to empty —', e);
    }
    return [];
  }
}

export async function fetchEventos(eventoLinks: NhEventoLink[], lang = 'es'): Promise<NhEvento[]> {
  const refs = eventoLinks.filter((el) => el.bundle === 'evento');
  if (!refs.length) return fetchEventosFromDrupal(lang);

  const results = await Promise.allSettled(refs.map((el) => fetchEventoHomeByUuid(el.id, lang)));
  const eventos: NhEvento[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) eventos.push(r.value);
    else if (r.status === 'rejected')
      console.warn('[NodeHive] Failed to resolve evento link:', r.reason);
  }
  return eventos;
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
