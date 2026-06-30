export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export interface OEmbedResult {
  title: string;
  thumbnailUrl: string;
  authorName: string;
}

const oembedCache = new Map<string, { data: OEmbedResult; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function clearCache(): void {
  oembedCache.clear();
}

export async function fetchOEmbed(videoId: string): Promise<OEmbedResult | null> {
  const cached = oembedCache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result: OEmbedResult = {
      title: data.title ?? '',
      thumbnailUrl: data.thumbnail_url ?? '',
      authorName: data.author_name ?? '',
    };
    oembedCache.set(videoId, { data: result, expires: Date.now() + CACHE_TTL });
    return result;
  } catch {
    return null;
  }
}

export interface ResolvedVideo {
  title: string;
  youtubeId: string | null;
  thumbnail: { url: string; alt: string; filename: string } | null;
}

export async function resolveVideoLink(title: string, url: string): Promise<ResolvedVideo> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return { title, youtubeId: null, thumbnail: null };

  const oembed = await fetchOEmbed(videoId);
  return {
    title: oembed?.title ?? title,
    youtubeId: videoId,
    thumbnail: oembed
      ? { url: oembed.thumbnailUrl, alt: oembed.title, filename: `${videoId}.jpg` }
      : null,
  };
}
