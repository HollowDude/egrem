import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractYouTubeId, fetchOEmbed, resolveVideoLink, clearCache } from '../youtube';

describe('extractYouTubeId', () => {
  it('extracts from youtube.com/watch?v= URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be/ URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtube.com/embed/ URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtube.com/shorts/ URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts raw video ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for invalid URL', () => {
    expect(extractYouTubeId('https://example.com/video')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractYouTubeId('')).toBeNull();
  });

  it('returns null for nullish input', () => {
    expect(extractYouTubeId(null as unknown as string)).toBeNull();
  });
});

describe('fetchOEmbed', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns oembed data on success', async () => {
    const mockData = {
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      author_name: 'Rick Astley',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchOEmbed('dQw4w9WgXcQ');
    expect(result).toEqual({
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      authorName: 'Rick Astley',
    });
  });

  it('returns null on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await fetchOEmbed('dQw4w9WgXcQ');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchOEmbed('dQw4w9WgXcQ');
    expect(result).toBeNull();
  });

  it('uses cache on second call', async () => {
    const mockData = {
      title: 'Test Video',
      thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
      author_name: 'Test Author',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    globalThis.fetch = fetchMock;

    await fetchOEmbed('test-id');
    await fetchOEmbed('test-id');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('resolveVideoLink', () => {
  beforeEach(() => {
    clearCache();
  });

  it('resolves a valid YouTube URL', async () => {
    const mockData = {
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      author_name: 'Rick Astley',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await resolveVideoLink('My Video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.title).toBe('Rick Astley - Never Gonna Give You Up');
    expect(result.youtubeId).toBe('dQw4w9WgXcQ');
    expect(result.thumbnail).toEqual({
      url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      alt: 'Rick Astley - Never Gonna Give You Up',
      filename: 'dQw4w9WgXcQ.jpg',
    });
  });

  it('falls back to original title when oEmbed fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await resolveVideoLink('Fallback Title', 'https://youtu.be/dQw4w9WgXcQ');
    expect(result.title).toBe('Fallback Title');
    expect(result.youtubeId).toBe('dQw4w9WgXcQ');
    expect(result.thumbnail).toBeNull();
  });

  it('returns null youtubeId for invalid URL', async () => {
    const result = await resolveVideoLink('No Video', 'https://example.com');
    expect(result.youtubeId).toBeNull();
    expect(result.thumbnail).toBeNull();
    expect(result.title).toBe('No Video');
  });
});
