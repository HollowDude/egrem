import { describe, it, expect } from 'vitest';
import { detectSocialNetwork, normalizePlatform, socialIconPath } from '../social';

describe('normalizePlatform', () => {
  it('should lowercase and strip separators', () => {
    expect(normalizePlatform('Facebook')).toBe('facebook');
    expect(normalizePlatform('YouTube')).toBe('youtube');
    expect(normalizePlatform('Face Book')).toBe('facebook');
    expect(normalizePlatform('  Instagram  ')).toBe('instagram');
  });
});

describe('detectSocialNetwork', () => {
  it('should detect by platform name', () => {
    expect(detectSocialNetwork('Facebook')).toBe('facebook');
    expect(detectSocialNetwork('Instagram')).toBe('instagram');
    expect(detectSocialNetwork('YouTube')).toBe('youtube');
    expect(detectSocialNetwork('Twitter')).toBe('x');
    expect(detectSocialNetwork('TikTok')).toBe('tiktok');
    expect(detectSocialNetwork('Spotify')).toBe('spotify');
    expect(detectSocialNetwork('Web')).toBe('web');
  });

  it('should detect by URL when platform is unknown', () => {
    expect(detectSocialNetwork('red', 'https://facebook.com/egrem')).toBe('facebook');
    expect(detectSocialNetwork('red', 'https://instagram.com/egrem')).toBe('instagram');
    expect(detectSocialNetwork('red', 'https://youtube.com/@egrem')).toBe('youtube');
    expect(detectSocialNetwork('red', 'https://youtu.be/abc')).toBe('youtube');
    expect(detectSocialNetwork('red', 'https://x.com/egrem')).toBe('x');
    expect(detectSocialNetwork('red', 'https://twitter.com/egrem')).toBe('x');
    expect(detectSocialNetwork('red', 'https://tiktok.com/@egrem')).toBe('tiktok');
    expect(detectSocialNetwork('red', 'https://open.spotify.com/artist/abc')).toBe('spotify');
  });

  it('should fall back to web for unknown networks', () => {
    expect(detectSocialNetwork('', 'https://egrem.cu')).toBe('web');
    expect(detectSocialNetwork('Mastodon', '')).toBe('web');
  });

  it('should prefer platform name over URL', () => {
    expect(detectSocialNetwork('Spotify', 'https://facebook.com/egrem')).toBe('spotify');
  });
});

describe('socialIconPath', () => {
  it('should return a non-empty path for every network', () => {
    for (const n of [
      'facebook',
      'instagram',
      'youtube',
      'x',
      'tiktok',
      'spotify',
      'soundcloud',
      'web',
    ]) {
      expect(socialIconPath(n as Parameters<typeof socialIconPath>[0])).toBeTruthy();
    }
  });

  it('should fall back to web path for unknown values', () => {
    expect(socialIconPath('unknown' as never)).toBe(socialIconPath('web'));
  });
});
