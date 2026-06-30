export function extractSpotifyId(url: string): { type: string; id: string } | null {
  if (!url) return null;
  const patterns = [
    /spotify\.com\/(?:[a-z-]+\/)?(track|album|artist|playlist)\/([a-zA-Z0-9]+)/,
    /^([a-zA-Z0-9]{22})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (match[2]) return { type: match[1], id: match[2] };
      if (match[1]) return { type: 'album', id: match[1] };
    }
  }
  return null;
}

export interface OEmbedResult {
  title: string;
  thumbnailUrl: string;
  html: string;
  iframeUrl: string;
}

const oembedCache = new Map<string, { data: OEmbedResult; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function clearCache(): void {
  oembedCache.clear();
}

export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  const cached = oembedCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const apiUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const result: OEmbedResult = {
      title: data.title ?? '',
      thumbnailUrl: data.thumbnail_url ?? '',
      html: data.html ?? '',
      iframeUrl: data.iframe_url ?? '',
    };
    oembedCache.set(url, { data: result, expires: Date.now() + CACHE_TTL });
    return result;
  } catch {
    return null;
  }
}

export interface ResolvedAlbum {
  title: string;
  spotifyId: string | null;
  cover: { url: string; alt: string; filename: string } | null;
  embedUrl: string;
}

export async function resolveSpotifyLink(title: string, url: string): Promise<ResolvedAlbum> {
  const parsed = extractSpotifyId(url);
  if (!parsed) return { title, spotifyId: null, cover: null, embedUrl: '' };

  const oembed = await fetchOEmbed(url);
  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;

  return {
    title: oembed?.title ?? title,
    spotifyId: parsed.id,
    cover: oembed
      ? { url: oembed.thumbnailUrl, alt: oembed.title, filename: `${parsed.id}.jpg` }
      : null,
    embedUrl,
  };
}
