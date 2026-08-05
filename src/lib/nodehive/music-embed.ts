import { extractSpotifyId } from './spotify';

export type MusicPlatform = 'spotify' | 'apple_music' | 'other';

export function detectPlatform(url: string): MusicPlatform {
  if (!url) return 'other';
  if (/open\.spotify\.com/.test(url)) return 'spotify';
  if (/music\.apple\.com/.test(url)) return 'apple_music';
  return 'other';
}

export function buildEmbedUrl(url: string): string | null {
  const platform = detectPlatform(url);
  if (platform === 'spotify') {
    const parsed = extractSpotifyId(url);
    if (!parsed) return null;
    return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
  }
  if (platform === 'apple_music') {
    return url.replace('music.apple.com', 'embed.music.apple.com');
  }
  return null;
}

export function platformLabel(platform: MusicPlatform): string {
  switch (platform) {
    case 'spotify':
      return 'Spotify';
    case 'apple_music':
      return 'Apple Music';
    default:
      return '';
  }
}

export const EMBED_CONFIG: Record<'spotify' | 'apple_music', { height: number; allow: string }> = {
  spotify: {
    height: 352,
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  },
  apple_music: {
    height: 450,
    allow: 'autoplay *; encrypted-media *;',
  },
};

export const EMBED_OPEN_EVENT = 'egrem:open-embed';

export interface EmbedOpenDetail {
  url: string;
  platform: MusicPlatform;
}
