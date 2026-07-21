import type { JsonApiResource, JsonApiRelationship, JsonApiResourceIdentifier } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhMediaImage } from './parsers';
import type { NhAlbumDiscografia } from './entities';

export interface CatalogoMusicaParams {
  sello?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CatalogoMusicaResult {
  albums: NhAlbumDiscografia[];
  total: number;
  totalPages: number;
  currentPage: number;
  availableSellos: { name: string; tid: number; slug: string }[];
}

export function parseAlbumCover(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[] | undefined,
): NhMediaImage | null {
  const rel = resource.relationships?.field_imagen_portada;
  const ids = resolveRelIds(rel);
  if (ids.length === 0) return null;
  const mediaRes = findIncluded(included, 'media--image', ids[0].id);
  if (!mediaRes) return null;
  const img = parseMediaImage(mediaRes, included);
  if (img?.url) img.url = resolveFileUrl(img.url);
  return img;
}

export function parseAlbumResource(
  resource: JsonApiResource<Record<string, unknown>>,
  included: JsonApiResource[],
): NhAlbumDiscografia {
  const a = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;

  const tracks: string[] = resolveRelIds(rels?.field_track_list).map((ref) => {
    const p = findIncluded(included, 'paragraph--album_tracks', ref.id);
    return (p?.attributes as Record<string, unknown>)?.field_track_title as string ?? '';
  }).filter(Boolean);

  const externalApps: { title: string; url: string }[] = resolveRelIds(rels?.field_external_apps).map((ref) => {
    const p = findIncluded(included, 'paragraph--external_apps', ref.id);
    const pa = p?.attributes as Record<string, unknown> | undefined;
    const link = pa?.field_app_link as { uri?: string; title?: string } | undefined;
    return {
      title: (pa?.field_titulo as string) ?? '',
      url: link?.uri ?? '',
    };
  }).filter((e) => e.url);

  const selloRel = rels?.field_sello?.data as JsonApiResourceIdentifier | undefined;
  let sello: { name: string; tid: number; slug: string } | undefined;
  if (selloRel) {
    const term = findIncluded(included, 'taxonomy_term--sello_discografico', selloRel.id);
    if (term) {
      const ta = term.attributes as Record<string, unknown>;
      const selloName = (ta.name as string) ?? '';
      sello = { name: selloName, tid: (ta.drupal_internal__tid as number) ?? 0, slug: selloName.toLowerCase().replace(/\s+/g, '-') };
    }
  }

  const bodyRel = a.body as { value?: string } | undefined;
  const href = (a.path as { alias?: string | null })?.alias ?? `/catalogo/musica/${a.drupal_internal__nid}`;

  return {
    id: resource.id,
    nid: (a.drupal_internal__nid as number) ?? 0,
    title: (a.title as string) ?? '',
    year: (a.field_year as number | null) ?? null,
    albumNumber: (a.field_album_number as number | null) ?? null,
    body: bodyRel?.value ?? '',
    cover: parseAlbumCover(resource as { relationships?: Record<string, JsonApiRelationship> }, included),
    sello: sello && sello.name ? sello : undefined,
    tracks,
    externalApps,
    href: href.startsWith('/') ? href : `/${href}`,
    artistName: (a.field_artist_name as string) ?? '',
  };
}

export async function fetchAlbumesCatalogo(
  params: CatalogoMusicaParams = {},
  lang = 'es',
): Promise<CatalogoMusicaResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const allSellos = new Map<string, { name: string; tid: number; slug: string }>();

  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?sort=-field_year&page[limit]=${limit}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_track_list,field_external_apps`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];

    let albums = data.map((resource) => {
      const discografia = parseAlbumResource(resource, included);

      const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
      if (rels?.field_sello?.data && !Array.isArray(rels.field_sello.data)) {
        const term = findIncluded(included, 'taxonomy_term--sello_discografico', rels.field_sello.data.id);
        if (term) {
          const ta = term.attributes as Record<string, unknown>;
          const name = (ta.name as string) ?? '';
          if (name) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            allSellos.set(slug, { name, tid: (ta.drupal_internal__tid as number) ?? 0, slug });
          }
        }
      }

      return discografia;
    });

    if (params.sello) {
      albums = albums.filter((a) => a.sello?.slug === params.sello);
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      albums = albums.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.artistName && a.artistName.toLowerCase().includes(q))
      );
    }

    const total = albums.length;
    const perPage = 24;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * perPage;
    const pageAlbums = albums.slice(start, start + perPage);

    return {
      albums: pageAlbums,
      total,
      totalPages,
      currentPage,
      availableSellos: Array.from(allSellos.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumesCatalogo failed:', e);
    return {
      albums: [],
      total: 0,
      totalPages: 0,
      currentPage: 1,
      availableSellos: [],
    };
  }
}

export async function fetchAlbumByPath(
  path: string,
  lang = 'es',
): Promise<NhAlbumDiscografia | null> {
  try {
    const cleanPath = path.replace(/^\/?(es\/|en\/)?/, '/').replace(/\/$/, '');
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?filter[path.alias][value]=${encodeURIComponent(cleanPath)}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_track_list,field_external_apps`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    return parseAlbumResource(data[0], res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumByPath failed:', e);
    return null;
  }
}

export async function fetchAlbumByNid(
  nid: number,
  lang = 'es',
): Promise<NhAlbumDiscografia | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?filter[drupal_internal__nid]=${nid}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_track_list,field_external_apps`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    return parseAlbumResource(data[0], res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumByNid failed:', e);
    return null;
  }
}
