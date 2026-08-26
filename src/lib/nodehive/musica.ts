import type { JsonApiResource, JsonApiRelationship, JsonApiResourceIdentifier } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds, slugify } from './helpers';
import { parseMediaImage, resolveFileUrl, normalizeDrupalUri } from './parsers';
import type { NhMediaImage } from './parsers';
import type { NhAlbumDiscografia, NhExternalApp, NhMusicPlatform, NhTrack } from './entities';
import { detectPlatform, buildEmbedUrl } from './music-embed';

export interface CatalogoMusicaParams {
  sello?: string;
  search?: string;
  decada?: string;
  disco?: string;
  artista?: string;
  agencia?: string;
  interprete?: string;
  page?: number;
  limit?: number;
}

export interface CatalogoMusicaResult {
  albums: NhAlbumDiscografia[];
  total: number;
  totalPages: number;
  currentPage: number;
  availableSellos: { name: string; tid: number; slug: string }[];
  availableDecadas: string[];
  availableDiscos: string[];
  availableArtistas: { name: string; slug: string; nid: number }[];
  availableAgencias: { name: string; slug: string }[];
  availableInterpretes: { name: string; slug: string; nid: number }[];
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

export function parseArtistaRef(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  field: string,
  included: JsonApiResource[],
): { name: string; slug: string; nid: number; href: string } | undefined {
  const rel = resource.relationships?.[field]?.data as JsonApiResourceIdentifier | undefined;
  if (!rel) return undefined;
  const artistRes = findIncluded(included, 'node--artista', rel.id);
  if (!artistRes) return undefined;
  const aa = artistRes.attributes as Record<string, unknown>;
  const name = (aa.title as string) ?? '';
  if (!name) return undefined;
  const nid = (aa.drupal_internal__nid as number) ?? 0;
  const path = (aa.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/artista/${nid}`;
  return {
    name,
    slug: slugify(name),
    nid,
    href,
  };
}

function parseAgencia(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[],
): { name: string; slug: string } | undefined {
  const rel = resource.relationships?.field_artista?.data as JsonApiResourceIdentifier | undefined;
  if (!rel) return undefined;
  const artistRes = findIncluded(included, 'node--artista', rel.id);
  if (!artistRes) return undefined;
  const agRel = artistRes.relationships?.field_agencia?.data as
    | JsonApiResourceIdentifier
    | undefined;
  if (!agRel) return undefined;
  const term = findIncluded(included, 'taxonomy_term--agencias', agRel.id);
  if (!term) return undefined;
  const ta = term.attributes as Record<string, unknown>;
  const name = (ta.name as string) ?? '';
  if (!name) return undefined;
  return { name, slug: slugify(name) };
}

function parseDecada(year: number | null): string {
  if (!year) return '';
  return `${Math.floor(year / 10) * 10}s`;
}

function parseTrackResource(
  trackRes: JsonApiResource | undefined,
  included: JsonApiResource[],
): NhTrack | null {
  if (!trackRes) return null;
  const ta = trackRes.attributes as Record<string, unknown>;
  const title =
    (ta.field_title as string) ?? (ta.title as string) ?? (ta.field_track_title as string) ?? '';
  if (!title) return null;
  const duration = (ta.field_duracion as number | null) ?? null;

  const audioRel = trackRes.relationships?.field_track_url?.data as
    | JsonApiResourceIdentifier
    | undefined;
  let audioUrl: string | null = null;
  if (audioRel) {
    const media = findIncluded(included, 'media--audio', audioRel.id);
    const fileRefs = resolveRelIds(media?.relationships?.field_media_audio_file);
    if (fileRefs.length > 0) {
      const file = findIncluded(included, 'file--file', fileRefs[0].id);
      const uri = (file?.attributes as Record<string, unknown> | undefined)?.uri as
        | { url?: string }
        | undefined;
      if (uri?.url) audioUrl = resolveFileUrl(uri.url);
    }
  }

  const previewLink = ta.field_enlace_preview as { uri?: string } | undefined;
  const previewUrl = previewLink?.uri ? normalizeDrupalUri(previewLink.uri) : null;
  const previewPlatform: NhMusicPlatform | null = previewUrl ? detectPlatform(previewUrl) : null;
  return {
    title,
    durationSeconds: duration,
    audioUrl,
    previewUrl,
    previewPlatform,
    previewEmbedUrl: previewUrl ? buildEmbedUrl(previewUrl) : null,
  };
}

export function parseAlbumResource(
  resource: JsonApiResource<Record<string, unknown>>,
  included: JsonApiResource[],
): NhAlbumDiscografia {
  const a = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;

  const tracks: NhTrack[] = resolveRelIds(rels?.field_track_list)
    .map((ref) => {
      const p =
        findIncluded(included, 'paragraph--lanzamiento_track', ref.id) ??
        findIncluded(included, 'paragraph--album_tracks', ref.id);
      if (!p) return null;
      const trackRel = p.relationships?.field_track?.data as JsonApiResourceIdentifier | undefined;
      const track = trackRel ? findIncluded(included, 'node--track', trackRel.id) : undefined;
      return track ? parseTrackResource(track, included) : parseTrackResource(p, included);
    })
    .filter((t): t is NhTrack => t !== null);

  const externalApps: NhExternalApp[] = resolveRelIds(rels?.field_external_apps)
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--external_apps', ref.id);
      const pa = p?.attributes as Record<string, unknown> | undefined;
      const link = pa?.field_app_link as { uri?: string; title?: string } | undefined;
      const url = link?.uri ? normalizeDrupalUri(link.uri) : '';
      if (!url) return null;
      const platform = detectPlatform(url);
      return {
        title: (pa?.field_titulo as string) ?? '',
        url,
        platform,
        embedUrl: buildEmbedUrl(url),
      };
    })
    .filter((e): e is NhExternalApp => e !== null);

  const selloRel = rels?.field_sello?.data as JsonApiResourceIdentifier | undefined;
  let sello: { name: string; tid: number; slug: string } | undefined;
  if (selloRel) {
    const term = findIncluded(included, 'taxonomy_term--sello_discografico', selloRel.id);
    if (term) {
      const ta = term.attributes as Record<string, unknown>;
      const selloName = (ta.name as string) ?? '';
      sello = {
        name: selloName,
        tid: (ta.drupal_internal__tid as number) ?? 0,
        slug: selloName.toLowerCase().replace(/\s+/g, '-'),
      };
    }
  }

  const bodyRel = a.body as { value?: string } | undefined;
  const href =
    (a.path as { alias?: string | null })?.alias ?? `/catalogo/musica/${a.drupal_internal__nid}`;

  const year = (a.field_year as number | null) ?? null;
  const artistaRef = parseArtistaRef(resource, 'field_artista', included);
  const interpreteRef = parseArtistaRef(resource, 'field_interprete', included);
  const agencia = parseAgencia(resource, included);

  const lanzamientoRel = rels?.field_tipo_lanzamiento?.data as
    | JsonApiResourceIdentifier
    | undefined;
  let lanzamiento: { name: string; tid: number; slug: string } | undefined;
  if (lanzamientoRel) {
    const term = findIncluded(included, 'taxonomy_term--tipo_de_lanzamiento', lanzamientoRel.id);
    if (term) {
      const ta = term.attributes as Record<string, unknown>;
      const lanzamientoName = (ta.name as string) ?? '';
      if (lanzamientoName) {
        lanzamiento = {
          name: lanzamientoName,
          tid: (ta.drupal_internal__tid as number) ?? 0,
          slug: lanzamientoName.toLowerCase().replace(/\s+/g, '-'),
        };
      }
    }
  }

  return {
    id: resource.id,
    nid: (a.drupal_internal__nid as number) ?? 0,
    title: (a.title as string) ?? '',
    year,
    albumNumber: (a.field_album_number as number | null) ?? null,
    decada: parseDecada(year),
    body: bodyRel?.value ?? '',
    cover: parseAlbumCover(
      resource as { relationships?: Record<string, JsonApiRelationship> },
      included,
    ),
    sello: sello && sello.name ? sello : undefined,
    lanzamiento,
    artista: artistaRef,
    interprete: interpreteRef,
    agencia,
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
  const allDecadas = new Set<string>();
  const allDiscos = new Set<string>();
  const allArtistas = new Map<string, { name: string; slug: string; nid: number }>();
  const allAgencias = new Map<string, { name: string; slug: string }>();
  const allInterpretes = new Map<string, { name: string; slug: string; nid: number }>();

  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?sort=-field_year&page[limit]=${limit}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_tipo_lanzamiento,field_track_list,field_track_list.field_track,field_track_list.field_track.field_track_url,field_track_list.field_track.field_track_url.field_media_audio_file,field_external_apps,field_artista,field_artista.field_agencia,field_interprete`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];

    let albums = data.map((resource) => {
      const discografia = parseAlbumResource(resource, included);

      const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
      if (rels?.field_sello?.data && !Array.isArray(rels.field_sello.data)) {
        const term = findIncluded(
          included,
          'taxonomy_term--sello_discografico',
          rels.field_sello.data.id,
        );
        if (term) {
          const ta = term.attributes as Record<string, unknown>;
          const name = (ta.name as string) ?? '';
          if (name) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            allSellos.set(slug, { name, tid: (ta.drupal_internal__tid as number) ?? 0, slug });
          }
        }
      }

      if (discografia.decada) allDecadas.add(discografia.decada);
      if (discografia.albumNumber !== null && discografia.albumNumber !== undefined) {
        allDiscos.add(String(discografia.albumNumber));
      }
      if (discografia.artista) {
        allArtistas.set(discografia.artista.slug, discografia.artista);
      }
      if (discografia.agencia) {
        allAgencias.set(discografia.agencia.slug, discografia.agencia);
      }
      if (discografia.interprete) {
        allInterpretes.set(discografia.interprete.slug, discografia.interprete);
      }

      return discografia;
    });

    if (params.sello) {
      albums = albums.filter((a) => a.sello?.slug === params.sello);
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      albums = albums.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.artistName && a.artistName.toLowerCase().includes(q)),
      );
    }

    if (params.decada) {
      albums = albums.filter((a) => a.decada === params.decada);
    }

    if (params.disco) {
      albums = albums.filter((a) => String(a.albumNumber) === params.disco);
    }

    if (params.artista) {
      albums = albums.filter((a) => a.artista?.slug === params.artista);
    }

    if (params.agencia) {
      albums = albums.filter((a) => a.agencia?.slug === params.agencia);
    }

    if (params.interprete) {
      albums = albums.filter((a) => a.interprete?.slug === params.interprete);
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
      availableDecadas: Array.from(allDecadas).sort((a, b) => parseInt(a) - parseInt(b)),
      availableDiscos: Array.from(allDiscos).sort((a, b) => parseInt(a) - parseInt(b)),
      availableArtistas: Array.from(allArtistas.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      availableAgencias: Array.from(allAgencias.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      availableInterpretes: Array.from(allInterpretes.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchAlbumesCatalogo failed:', e);
    return {
      albums: [],
      total: 0,
      totalPages: 0,
      currentPage: 1,
      availableSellos: [],
      availableDecadas: [],
      availableDiscos: [],
      availableArtistas: [],
      availableAgencias: [],
      availableInterpretes: [],
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
      `node/album?filter[path.alias][value]=${encodeURIComponent(cleanPath)}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_tipo_lanzamiento,field_track_list,field_track_list.field_track,field_track_list.field_track.field_track_url,field_track_list.field_track.field_track_url.field_media_audio_file,field_external_apps,field_artista,field_artista.field_agencia,field_interprete`,
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
      `node/album?filter[drupal_internal__nid]=${nid}&include=field_imagen_portada,field_imagen_portada.field_media_image,field_sello,field_tipo_lanzamiento,field_track_list,field_track_list.field_track,field_track_list.field_track.field_track_url,field_track_list.field_track.field_track_url.field_media_audio_file,field_external_apps,field_artista,field_artista.field_agencia,field_interprete`,
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
