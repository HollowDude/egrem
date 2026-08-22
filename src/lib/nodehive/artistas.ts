import type { JsonApiResource, JsonApiRelationship } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl, normalizeDrupalUri } from './parsers';
import type { NhMediaImage } from './parsers';
import { resolveVideoLink } from './youtube';
import type {
  NhArtistaListItem,
  NhArtistaDetail,
  NhRedSocial,
  NhAlbumDiscografia,
  NhArtistaVideo,
} from './entities';
import { parseAlbumResource } from './musica';

function parseAgencia(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[] | undefined,
): { name: string; slug: string; tid: number } | undefined {
  const rel = resource.relationships?.field_agencia;
  if (!rel?.data || Array.isArray(rel.data)) return undefined;
  const term = findIncluded(included, 'taxonomy_term--agencias', rel.data.id);
  if (!term) return undefined;
  const a = term.attributes as Record<string, unknown>;
  const name = (a.name as string) ?? '';
  if (!name) return undefined;
  return {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    tid: a.drupal_internal__tid as number,
  };
}

function parseImage(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[] | undefined,
): NhMediaImage | null {
  const rel = resource.relationships?.field_imagen;
  const ids = resolveRelIds(rel);
  if (ids.length === 0) return null;
  const mediaRes = findIncluded(included, 'media--image', ids[0].id);
  if (!mediaRes) return null;
  const img = parseMediaImage(mediaRes, included);
  if (img?.url) img.url = resolveFileUrl(img.url);
  return img;
}

function parseRedesSociales(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[] | undefined,
): NhRedSocial[] {
  return resolveRelIds(
    (resource.relationships as Record<string, JsonApiRelationship> | undefined)
      ?.field_redes_sociales,
  )
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--redsocial_artista', ref.id);
      const pa = p?.attributes as Record<string, unknown> | undefined;
      const enlace = pa?.field_enlace as { uri?: string; title?: string } | undefined;
      return {
        id: ref.id,
        platform: (pa?.field_icon as string) ?? '',
        url: enlace?.uri ? normalizeDrupalUri(enlace.uri) : '',
        label: enlace?.title ?? '',
      };
    })
    .filter((s) => s.url);
}

export async function fetchArtistas(lang = 'es'): Promise<NhArtistaListItem[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/artista?sort=title&page[limit]=50&include=field_imagen,field_imagen.field_media_image,field_agencia`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];

    return data.map((resource) => {
      const a = resource.attributes as Record<string, unknown>;
      const href =
        (a.path as { alias?: string | null })?.alias ?? `/artista/${a.drupal_internal__nid}`;
      return {
        id: resource.id,
        nid: (a.drupal_internal__nid as number) ?? 0,
        name: (a.title as string) ?? '',
        image: parseImage(
          resource as { relationships?: Record<string, JsonApiRelationship> },
          included,
        ),
        agencia: parseAgencia(
          resource as { relationships?: Record<string, JsonApiRelationship> },
          included,
        ),
        body: (a.body as { value?: string })?.value ?? '',
        summary: (a.body as { summary?: string })?.summary ?? '',
        href: href.startsWith('/') ? href : `/${href}`,
      };
    });
  } catch (e) {
    console.warn('[NodeHive] fetchArtistas failed:', e);
    return [];
  }
}

export async function fetchArtistaByPath(
  path: string,
  lang = 'es',
): Promise<NhArtistaDetail | null> {
  try {
    const cleanPath = path.replace(/^\/?(es\/|en\/)?/, '/').replace(/\/$/, '');
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/artista?filter[path.alias][value]=${encodeURIComponent(cleanPath)}&include=field_imagen,field_imagen.field_media_image,field_agencia,field_redes_sociales`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    const resource = data[0] as JsonApiResource<Record<string, unknown>>;
    const a = resource.attributes as Record<string, unknown>;
    const included = res.included ?? [];

    const href =
      (a.path as { alias?: string | null })?.alias ?? `/artista/${a.drupal_internal__nid}`;

    return {
      id: resource.id,
      nid: (a.drupal_internal__nid as number) ?? 0,
      name: (a.title as string) ?? '',
      image: parseImage(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
      agencia: parseAgencia(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
      body: (a.body as { value?: string })?.value ?? '',
      summary: (a.body as { summary?: string })?.summary ?? '',
      href: href.startsWith('/') ? href : `/${href}`,
      redesSociales: parseRedesSociales(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchArtistaByPath failed:', e);
    return null;
  }
}

export async function fetchArtistaByNid(nid: number, lang = 'es'): Promise<NhArtistaDetail | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/artista?filter[drupal_internal__nid]=${nid}&include=field_imagen,field_imagen.field_media_image,field_agencia,field_redes_sociales`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    const resource = data[0] as JsonApiResource<Record<string, unknown>>;
    const a = resource.attributes as Record<string, unknown>;
    const included = res.included ?? [];
    const href =
      (a.path as { alias?: string | null })?.alias ?? `/artista/${a.drupal_internal__nid}`;

    return {
      id: resource.id,
      nid: (a.drupal_internal__nid as number) ?? 0,
      name: (a.title as string) ?? '',
      image: parseImage(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
      agencia: parseAgencia(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
      body: (a.body as { value?: string })?.value ?? '',
      summary: (a.body as { summary?: string })?.summary ?? '',
      href: href.startsWith('/') ? href : `/${href}`,
      redesSociales: parseRedesSociales(
        resource as { relationships?: Record<string, JsonApiRelationship> },
        included,
      ),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchArtistaByNid failed:', e);
    return null;
  }
}

export async function fetchVideosByArtista(
  artistaId: string,
  lang = 'es',
): Promise<NhArtistaVideo[]> {
  if (!artistaId) return [];
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/video_yt?filter[field_artistas.id][value]=${encodeURIComponent(artistaId)}&sort=-created`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];

    const videos: NhArtistaVideo[] = [];
    for (const resource of data) {
      const a = resource.attributes as Record<string, unknown>;
      const link = a.field_link as { uri?: string; title?: string } | undefined;
      const rawUrl = link?.uri ?? '';
      if (!rawUrl) continue;

      const resolved = await resolveVideoLink('', rawUrl);
      videos.push({
        id: resource.id,
        url: normalizeDrupalUri(rawUrl),
        youtubeId: resolved.youtubeId,
        title: resolved.title || link?.title || (a.title as string) || '',
        thumbnail: resolved.thumbnail?.url ?? null,
      });
    }
    return videos;
  } catch (e) {
    console.warn('[NodeHive] fetchVideosByArtista failed:', e);
    return [];
  }
}

export async function fetchAlbumsByArtist(
  artistaNid: number,
  lang = 'es',
): Promise<NhAlbumDiscografia[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?filter[field_artista.drupal_internal__nid]=${artistaNid}&sort=field_year&page[limit]=50&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_track_list,field_external_apps`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return data.map((resource) => parseAlbumResource(resource, res.included ?? []));
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumsByArtist failed:', e);
    return [];
  }
}
