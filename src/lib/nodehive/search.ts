import type { JsonApiResponse } from './client';
import { jsonApiFetch } from './client';
import { fetchAllArtistVideos } from './videos';
import type { NhCatalogoVideo } from './entities';

export interface NhSearchResult {
  type: 'album' | 'artista' | 'actualidad' | 'video';
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  href: string;
  youtubeId?: string | null;
}

export interface NhSearchResponse {
  query: string;
  total: number;
  results: NhSearchResult[];
}

const RESULTS_PER_TYPE = 5;

const videosCache = new Map<string, { data: NhCatalogoVideo[]; expires: number }>();
const CACHE_TTL = 60_000;

export function clearSearchCache(): void {
  videosCache.clear();
}

async function getCachedVideos(lang: string): Promise<NhCatalogoVideo[]> {
  const cached = videosCache.get(lang);
  if (cached && cached.expires > Date.now()) return cached.data;
  const videos = await fetchAllArtistVideos(lang);
  videosCache.set(lang, { data: videos, expires: Date.now() + CACHE_TTL });
  return videos;
}

function buildFilter(q: string): string {
  return `filter[search][condition][path]=title&filter[search][condition][operator]=CONTAINS&filter[search][condition][value]=${encodeURIComponent(q)}`;
}

export async function searchAlbums(q: string, lang = 'es'): Promise<NhSearchResult[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/album?${buildFilter(q)}&page[limit]=${RESULTS_PER_TYPE}&include=field_artista`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : [];
    const included = res.included ?? [];

    return data.map((r) => {
      const a = r.attributes as Record<string, unknown>;
      const nid = a.drupal_internal__nid as number;
      const artRel = r.relationships?.field_artista?.data as { type: string; id: string } | undefined;
      let artistName = '';
      if (artRel) {
        const artist = included.find((i) => i.type === artRel.type && i.id === artRel.id);
        const artistAttrs = artist?.attributes as Record<string, unknown> | undefined;
        artistName = (artistAttrs?.title as string) ?? '';
      }
      return {
        type: 'album' as const,
        id: r.id,
        title: (a.title as string) ?? '',
        subtitle: artistName,
        thumbnail: null,
        href: `/catalogo/musica/${nid}`,
      };
    });
  } catch {
    return [];
  }
}

export async function searchArtistas(q: string, lang = 'es'): Promise<NhSearchResult[]> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/artista?${buildFilter(q)}&page[limit]=${RESULTS_PER_TYPE}`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : [];

    return data.map((r) => {
      const a = r.attributes as Record<string, unknown>;
      const nid = a.drupal_internal__nid as number;
      return {
        type: 'artista' as const,
        id: r.id,
        title: (a.title as string) ?? '',
        subtitle: '',
        thumbnail: null,
        href: `/artista/${nid}`,
      };
    });
  } catch {
    return [];
  }
}

export async function searchActualidad(q: string, lang = 'es'): Promise<NhSearchResult[]> {
  const bundles = ['noticia', 'blog', 'article'];

  try {
    const results = await Promise.allSettled(
      bundles.map((bundle) =>
        jsonApiFetch<Record<string, unknown>>(
          `node/${bundle}?${buildFilter(q)}&page[limit]=${RESULTS_PER_TYPE}`,
          lang,
        ),
      ),
    );

    const items: NhSearchResult[] = [];

    for (const result of results) {
      if (result.status === 'rejected') continue;
      const res = result.value as JsonApiResponse<Record<string, unknown>>;
      const data = Array.isArray(res.data) ? res.data : [];

      for (const r of data) {
        const a = r.attributes as Record<string, unknown>;
        const nid = a.drupal_internal__nid as number;
        const type = r.type;
        const bundle = type.replace('node--', '');
        items.push({
          type: 'actualidad' as const,
          id: r.id,
          title: (a.title as string) ?? '',
          subtitle: '',
          thumbnail: null,
          href: `/actualidad/${bundle}/${nid}`,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

export async function searchVideos(q: string, lang = 'es'): Promise<NhSearchResult[]> {
  try {
    const needle = q.toLowerCase();
    const allVideos = await getCachedVideos(lang);
    const filtered = allVideos.filter(
      (v) => v.title.toLowerCase().includes(needle) || v.artistName.toLowerCase().includes(needle),
    );
    return filtered.slice(0, RESULTS_PER_TYPE).map((v) => ({
      type: 'video' as const,
      id: v.id,
      title: v.title,
      subtitle: v.artistName,
      thumbnail: v.thumbnail,
      href: '',
      youtubeId: v.youtubeId,
    }));
  } catch {
    return [];
  }
}

export async function searchContent(q: string, lang = 'es'): Promise<NhSearchResponse> {
  const needle = q.trim();

  if (needle.length < 2) {
    return { query: needle, total: 0, results: [] };
  }

  const [albums, artistas, actualidad, videos] = await Promise.allSettled([
    searchAlbums(needle, lang),
    searchArtistas(needle, lang),
    searchActualidad(needle, lang),
    searchVideos(needle, lang),
  ]);

  const results: NhSearchResult[] = [];
  for (const r of [albums, artistas, actualidad, videos]) {
    if (r.status === 'fulfilled') results.push(...r.value);
    else console.warn('[NodeHive] search: una fuente falló:', r.reason);
  }

  return { query: q, total: results.length, results };
}
