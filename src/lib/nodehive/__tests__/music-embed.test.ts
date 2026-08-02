import { describe, it, expect } from 'vitest';
import { detectPlatform, buildEmbedUrl, platformLabel } from '../music-embed';

describe('detectPlatform', () => {
  it('detects Spotify', () => {
    expect(detectPlatform('https://open.spotify.com/album/7vI4iTxDmgEN63liQHPEX1')).toBe('spotify');
  });

  it('detects Apple Music', () => {
    expect(detectPlatform('https://music.apple.com/us/album/imagina/1523000000')).toBe('apple_music');
  });

  it('returns other for unknown URLs', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBe('other');
    expect(detectPlatform('')).toBe('other');
  });
});

describe('buildEmbedUrl', () => {
  it('builds Spotify embed URL', () => {
    expect(buildEmbedUrl('https://open.spotify.com/album/7vI4iTxDmgEN63liQHPEX1')).toBe(
      'https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1',
    );
  });

  it('builds Spotify track embed URL', () => {
    expect(buildEmbedUrl('https://open.spotify.com/track/4i4BVY2JiH4mDSLIBdNGKD')).toBe(
      'https://open.spotify.com/embed/track/4i4BVY2JiH4mDSLIBdNGKD',
    );
  });

  it('builds Apple Music embed URL', () => {
    expect(
      buildEmbedUrl('https://music.apple.com/us/album/imagina/1523000000'),
    ).toBe('https://embed.music.apple.com/us/album/imagina/1523000000');
  });

  it('returns null for Spotify URLs without a valid ID', () => {
    expect(buildEmbedUrl('https://open.spotify.com/collection')).toBeNull();
  });

  it('returns null for unknown platforms', () => {
    expect(buildEmbedUrl('https://example.com/album/1')).toBeNull();
  });
});

describe('platformLabel', () => {
  it('returns labels for known platforms', () => {
    expect(platformLabel('spotify')).toBe('Spotify');
    expect(platformLabel('apple_music')).toBe('Apple Music');
  });

  it('returns empty string for other', () => {
    expect(platformLabel('other')).toBe('');
  });
});
