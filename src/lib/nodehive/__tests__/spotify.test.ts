import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSpotifyId, fetchOEmbed, resolveSpotifyLink, clearCache } from '../spotify';

describe('extractSpotifyId', () => {
  it('extracts album ID from open.spotify.com/album/', () => {
    const result = extractSpotifyId('https://open.spotify.com/album/7vI4iTxDmgEN63liQHPEX1');
    expect(result).toEqual({ type: 'album', id: '7vI4iTxDmgEN63liQHPEX1' });
  });

  it('extracts track ID from open.spotify.com/track/', () => {
    const result = extractSpotifyId('https://open.spotify.com/track/4i4BVY2JiH4mDSLIBdNGKD');
    expect(result).toEqual({ type: 'track', id: '4i4BVY2JiH4mDSLIBdNGKD' });
  });

  it('extracts artist ID', () => {
    const result = extractSpotifyId('https://open.spotify.com/artist/1vCWHaC5f2uS3yLPw5Ye0');
    expect(result).toEqual({ type: 'artist', id: '1vCWHaC5f2uS3yLPw5Ye0' });
  });

  it('extracts playlist ID', () => {
    const result = extractSpotifyId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    expect(result).toEqual({ type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
  });

  it('handles URLs with locale prefix', () => {
    const result = extractSpotifyId('https://open.spotify.com/intl-es/album/7vI4iTxDmgEN63liQHPEX1');
    expect(result).toEqual({ type: 'album', id: '7vI4iTxDmgEN63liQHPEX1' });
  });

  it('returns null for invalid URL', () => {
    expect(extractSpotifyId('https://example.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractSpotifyId('')).toBeNull();
  });
});

describe('fetchOEmbed', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns oembed data on success', async () => {
    const mockData = {
      title: 'The Romantic',
      thumbnail_url: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023eb8dc748f7efb1470f74395',
      html: '<iframe src="https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1"></iframe>',
      iframe_url: 'https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1?utm_source=oembed',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchOEmbed('https://open.spotify.com/album/7vI4iTxDmgEN63liQHPEX1');
    expect(result).toEqual({
      title: 'The Romantic',
      thumbnailUrl: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023eb8dc748f7efb1470f74395',
      html: '<iframe src="https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1"></iframe>',
      iframeUrl: 'https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1?utm_source=oembed',
    });
  });

  it('returns null on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await fetchOEmbed('https://open.spotify.com/album/test');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchOEmbed('https://open.spotify.com/album/test');
    expect(result).toBeNull();
  });

  it('uses cache on second call', async () => {
    const mockData = {
      title: 'Test',
      thumbnail_url: 'https://example.com/img.jpg',
      html: '<iframe></iframe>',
      iframe_url: 'https://open.spotify.com/embed/test',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    globalThis.fetch = fetchMock;

    await fetchOEmbed('https://open.spotify.com/album/test');
    await fetchOEmbed('https://open.spotify.com/album/test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('resolveSpotifyLink', () => {
  beforeEach(() => {
    clearCache();
  });

  it('resolves a valid Spotify album URL', async () => {
    const mockData = {
      title: 'The Romantic',
      thumbnail_url: 'https://image-cdn-fa.spotifycdn.com/image/test.jpg',
      html: '<iframe></iframe>',
      iframe_url: 'https://open.spotify.com/embed/album/test?utm_source=oembed',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await resolveSpotifyLink('My Album', 'https://open.spotify.com/album/test');
    expect(result.title).toBe('The Romantic');
    expect(result.spotifyId).toBe('test');
    expect(result.cover).toEqual({
      url: 'https://image-cdn-fa.spotifycdn.com/image/test.jpg',
      alt: 'The Romantic',
      filename: 'test.jpg',
    });
    expect(result.embedUrl).toBe('https://open.spotify.com/embed/album/test');
  });

  it('falls back to original title when oEmbed fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await resolveSpotifyLink('Fallback Title', 'https://open.spotify.com/album/test');
    expect(result.title).toBe('Fallback Title');
    expect(result.spotifyId).toBe('test');
    expect(result.cover).toBeNull();
  });

  it('returns null spotifyId for invalid URL', async () => {
    const result = await resolveSpotifyLink('No Album', 'https://example.com');
    expect(result.spotifyId).toBeNull();
    expect(result.cover).toBeNull();
    expect(result.embedUrl).toBe('');
  });
});
