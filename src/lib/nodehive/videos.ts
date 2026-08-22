import type { JsonApiResource, JsonApiRelationship } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds, slugify } from './helpers';
import { normalizeDrupalUri } from './parsers';
import { resolveVideoLink, fetchVideoDetail } from './youtube';
import type {
  NhCatalogoVideo,
  NhVideoDestacado,
  NhVideoArtistaRef,
  CatalogoVideosParams,
  CatalogoVideosResult,
} from './entities';

function parseTipo(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[],
): { name: string; slug: string } | undefined {
  const rel = resource.relationships?.field_tipo_video;
  if (!rel?.data || Array.isArray(rel.data)) return undefined;
  const term = findIncluded(included, 'taxonomy_term--tipo_video', rel.data.id);
  if (!term) return undefined;
  const ta = term.attributes as Record<string, unknown>;
  const name = (ta.name as string) ?? '';
  if (!name) return undefined;
  return { name, slug: slugify(name) };
}

export async function fetchAllArtistVideos(lang = 'es'): Promise<NhCatalogoVideo[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/video_yt?page[limit]=200&include=field_artistas,field_tipo_video&sort=-created`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];
    const seen = new Set<string>();
    const videos: NhCatalogoVideo[] = [];

    for (const resource of data) {
      const a = resource.attributes as Record<string, unknown>;
      const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
      const link = a.field_link as { uri?: string; title?: string } | undefined;
      const rawUrl = link?.uri ?? '';
      if (!rawUrl) continue;

      const resolved = await resolveVideoLink('', rawUrl);
      if (!resolved.youtubeId || seen.has(resolved.youtubeId)) continue;
      seen.add(resolved.youtubeId);

      const artistas: NhVideoArtistaRef[] = resolveRelIds(rels?.field_artistas).map((ref) => {
        const artistRes = findIncluded(included, 'node--artista', ref.id);
        const aa = artistRes?.attributes as Record<string, unknown> | undefined;
        const nid = (aa?.drupal_internal__nid as number) ?? 0;
        const href = (aa?.path as { alias?: string | null })?.alias ?? `/artista/${nid}`;
        return {
          name: (aa?.title as string) ?? '',
          href: href.startsWith('/') ? href : `/${href}`,
          nid,
        };
      });

      videos.push({
        id: resource.id,
        url: normalizeDrupalUri(rawUrl),
        youtubeId: resolved.youtubeId,
        title: resolved.title || link?.title || (a.title as string) || '',
        thumbnail: resolved.thumbnail?.url ?? null,
        body: (a.body as { value?: string } | undefined)?.value ?? '',
        artistas,
        tipo: parseTipo(resource, included),
      });
    }

    return videos;
  } catch (e) {
    console.warn('[NodeHive] fetchAllArtistVideos failed:', e);
    return [];
  }
}

export async function fetchVideosCatalogo(
  params: CatalogoVideosParams = {},
  lang = 'es',
): Promise<CatalogoVideosResult> {
  const page = params.page ?? 1;
  const allArtistas = new Map<string, { name: string; slug: string; nid: number }>();
  const allTipos = new Map<string, { name: string; slug: string }>();
  const perPage = 10;

  try {
    let videos = await fetchAllArtistVideos(lang);

    for (const v of videos) {
      for (const artist of v.artistas) {
        const s = slugify(artist.name);
        if (!allArtistas.has(s)) {
          allArtistas.set(s, { name: artist.name, slug: s, nid: artist.nid });
        }
      }
      if (v.tipo) {
        allTipos.set(v.tipo.slug, v.tipo);
      }
    }

    if (params.artista) {
      videos = videos.filter((v) =>
        v.artistas.some((artist) => slugify(artist.name) === params.artista),
      );
    }

    if (params.tipo) {
      videos = videos.filter((v) => v.tipo?.slug === params.tipo);
    }

    const total = videos.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * perPage;
    const pageVideos = videos.slice(start, start + perPage);

    return {
      videos: pageVideos,
      total,
      totalPages,
      currentPage,
      hasMore: currentPage < totalPages,
      availableArtistas: Array.from(allArtistas.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      availableTipos: Array.from(allTipos.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchVideosCatalogo failed:', e);
    return {
      videos: [],
      total: 0,
      totalPages: 0,
      currentPage: 1,
      hasMore: false,
      availableArtistas: [],
      availableTipos: [],
    };
  }
}

export async function fetchVideoDestacado(
  pageUUID: string,
  lang = 'es',
): Promise<NhVideoDestacado | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/astro_page/${pageUUID}?include=field_components.field_video_yt`,
      lang,
    );
    const included = res.included ?? [];
    const destacado = included.find(
      (i: JsonApiResource) => i.type === 'paragraph--_component_videos_destacado',
    );
    if (!destacado) return null;

    const rels = destacado.relationships as Record<string, JsonApiRelationship> | undefined;
    const videoRel = rels?.field_video_yt;
    if (!videoRel?.data || Array.isArray(videoRel.data)) return null;

    const videoRes = findIncluded(included, 'node--video_yt', videoRel.data.id);
    if (!videoRes) return null;

    const vAttrs = videoRes.attributes as Record<string, unknown>;
    const link = vAttrs.field_link as { uri: string; title: string } | undefined;
    if (!link?.uri) return null;

    const resolved = await resolveVideoLink('', link.uri);
    const detail = resolved.youtubeId ? await fetchVideoDetail(resolved.youtubeId) : null;

    return {
      url: normalizeDrupalUri(link.uri),
      youtubeId: resolved.youtubeId,
      title: resolved.title || link.title || (vAttrs.title as string) || '',
      thumbnail: resolved.thumbnail?.url ?? null,
      detail,
    };
  } catch (e) {
    console.warn('[NodeHive] fetchVideoDestacado failed:', e);
    return null;
  }
}
