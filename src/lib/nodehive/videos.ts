import type { JsonApiResource, JsonApiRelationship } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { normalizeDrupalUri } from './parsers';
import { resolveVideoLink, fetchVideoDetail } from './youtube';
import type {
  NhCatalogoVideo,
  NhVideoDestacado,
  CatalogoVideosParams,
  CatalogoVideosResult,
} from './entities';

export async function fetchAllArtistVideos(lang = 'es'): Promise<NhCatalogoVideo[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/artista?page[limit]=100&include=field_videos_artista`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included ?? [];
    const seen = new Set<string>();
    const videos: NhCatalogoVideo[] = [];

    for (const resource of data) {
      const a = resource.attributes as Record<string, unknown>;
      const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
      const artistName = (a.title as string) ?? '';
      const artistHref = (a.path as { alias?: string | null })?.alias ?? `/artista/${a.drupal_internal__nid}`;
      const artistPath = artistHref.startsWith('/') ? artistHref : `/${artistHref}`;

      const vidRefs = resolveRelIds(rels?.field_videos_artista);
      for (const ref of vidRefs) {
        const p = findIncluded(included, 'paragraph--videos_artista', ref.id);
        if (!p) continue;
        const pa = p.attributes as Record<string, unknown>;
        const urlField = pa.field_url_video as { uri?: string; title?: string } | undefined;
        const rawUrl = urlField?.uri ?? '';
        if (!rawUrl) continue;

        const resolved = await resolveVideoLink('', rawUrl);
        if (!resolved.youtubeId || seen.has(resolved.youtubeId)) continue;
        seen.add(resolved.youtubeId);

        videos.push({
          id: ref.id,
          url: normalizeDrupalUri(rawUrl),
          youtubeId: resolved.youtubeId,
          title: resolved.title,
          thumbnail: resolved.thumbnail?.url ?? null,
          artistName,
          artistHref: artistPath,
        });
      }
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
  const perPage = 24;

  try {
    let videos = await fetchAllArtistVideos(lang);

    for (const v of videos) {
      const slug = v.artistName.toLowerCase().replace(/\s+/g, '-');
      if (!allArtistas.has(slug)) {
        allArtistas.set(slug, { name: v.artistName, slug, nid: 0 });
      }
    }

    if (params.artista) {
      videos = videos.filter((v) => {
        const slug = v.artistName.toLowerCase().replace(/\s+/g, '-');
        return slug === params.artista;
      });
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
      availableArtistas: Array.from(allArtistas.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (e) {
    console.warn('[NodeHive] fetchVideosCatalogo failed:', e);
    return {
      videos: [],
      total: 0,
      totalPages: 0,
      currentPage: 1,
      availableArtistas: [],
    };
  }
}

export async function fetchVideoDestacado(
  pageUUID: string,
  lang = 'es',
): Promise<NhVideoDestacado | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/astro_page/${pageUUID}?include=field_components`,
      lang,
    );
    const included = res.included ?? [];
    const destacado = included.find(
      (i: JsonApiResource) => i.type === 'paragraph--_component_videos_destacado',
    );
    if (!destacado) return null;

    const attrs = destacado.attributes as Record<string, unknown>;
    const link = attrs.field_link_destacado as { uri: string; title: string } | undefined;
    if (!link?.uri) return null;

    const resolved = await resolveVideoLink('', link.uri);
    const detail = resolved.youtubeId ? await fetchVideoDetail(resolved.youtubeId) : null;

    return {
      url: normalizeDrupalUri(link.uri),
      youtubeId: resolved.youtubeId,
      title: resolved.title,
      thumbnail: resolved.thumbnail?.url ?? null,
      detail,
    };
  } catch (e) {
    console.warn('[NodeHive] fetchVideoDestacado failed:', e);
    return null;
  }
}
