import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
}));

const mockFetchAllArtistVideos = vi.hoisted(() => vi.fn());

vi.mock('../videos', () => ({
  fetchAllArtistVideos: mockFetchAllArtistVideos,
}));

import { searchContent, searchAlbums, searchArtistas, searchActualidad, searchVideos, clearSearchCache } from '../search';
import type { NhSearchResult } from '../search';

function makeNode(id: string, nid: number, title: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    type: `node--${type}`,
    id,
    attributes: { drupal_internal__nid: nid, title, status: true, ...extra },
    relationships: {},
  };
}

describe('clearSearchCache', () => {
  it('clears the cache without error', () => {
    clearSearchCache();
  });
});

describe('searchAlbums', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await searchAlbums('test', 'es');
    expect(result).toEqual([]);
  });

  it('returns albums filtered by title', async () => {
    mockJsonApiFetch.mockResolvedValue({
      data: [makeNode('a1', 41, 'Candela de album', 'album')],
      included: [],
    });
    const result = await searchAlbums('candela', 'es');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Candela de album');
    expect(result[0].type).toBe('album');
    expect(result[0].href).toBe('/catalogo/musica/41');
  });

  it('includes artist name via relationship', async () => {
    const artistNode = {
      type: 'node--artista',
      id: 'artist-uuid',
      attributes: { title: 'Test Artist', drupal_internal__nid: 99 },
    };
    const albumNode = makeNode('a1', 41, 'Test Album', 'album');
    albumNode.relationships = {
      field_artista: { data: { type: 'node--artista', id: 'artist-uuid' } },
    };

    mockJsonApiFetch.mockResolvedValue({
      data: [albumNode],
      included: [artistNode],
    });
    const result = await searchAlbums('test', 'es');
    expect(result[0].subtitle).toBe('Test Artist');
  });
});

describe('searchArtistas', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await searchArtistas('test', 'es');
    expect(result).toEqual([]);
  });

  it('returns artistas filtered by title', async () => {
    mockJsonApiFetch.mockResolvedValue({
      data: [makeNode('ar1', 7, 'Marisney Elvira', 'artista')],
    });
    const result = await searchArtistas('mar', 'es');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Marisney Elvira');
    expect(result[0].type).toBe('artista');
    expect(result[0].href).toBe('/artista/7');
  });
});

describe('searchActualidad', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await searchActualidad('test', 'es');
    expect(result).toEqual([]);
  });

  it('searches across all bundles', async () => {
    mockJsonApiFetch
      .mockResolvedValueOnce({
        data: [makeNode('n1', 8, 'Que loquera', 'noticia')],
      })
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [makeNode('b1', 10, 'Bog de locos', 'blog')],
      });

    const result = await searchActualidad('locos', 'es');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('actualidad');
    expect(result[0].href).toBe('/actualidad/noticia/8');
    expect(result[1].href).toBe('/actualidad/blog/10');
  });
});

describe('searchVideos', () => {
  beforeEach(() => {
    mockFetchAllArtistVideos.mockReset();
    clearSearchCache();
  });

  it('returns empty array on fetch failure', async () => {
    mockFetchAllArtistVideos.mockRejectedValue(new Error('Network'));
    const result = await searchVideos('test', 'es');
    expect(result).toEqual([]);
  });

  it('filters by title and artist name', async () => {
    mockFetchAllArtistVideos.mockResolvedValue([
      { id: 'v1', title: 'Concierto Especial', youtubeId: 'abc123', thumbnail: 'thumb.jpg', artistName: 'Artist A', artistHref: '/artista/1', artistNid: 1, url: '' },
      { id: 'v2', title: 'Entrevista', youtubeId: 'xyz789', thumbnail: null, artistName: 'Special Guest', artistHref: '/artista/2', artistNid: 2, url: '' },
      { id: 'v3', title: 'Otro', youtubeId: 'def456', thumbnail: null, artistName: 'Nobody', artistHref: '/artista/3', artistNid: 3, url: '' },
    ]);

    const result = await searchVideos('special', 'es');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Concierto Especial');
    expect(result[1].subtitle).toBe('Special Guest');
    expect(result[0].type).toBe('video');
    expect(result[0].youtubeId).toBe('abc123');
  });

  it('caches videos between calls', async () => {
    clearSearchCache();
    mockFetchAllArtistVideos.mockResolvedValue([
      { id: 'v1', title: 'Cached Video', youtubeId: 'abc123', thumbnail: null, artistName: 'Artist', artistHref: '/artista/1', artistNid: 1, url: '' },
    ]);

    await searchVideos('cached', 'es');
    await searchVideos('cached', 'es');

    expect(mockFetchAllArtistVideos).toHaveBeenCalledTimes(1);
  });
});

describe('searchContent', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
    mockFetchAllArtistVideos.mockReset();
    clearSearchCache();
  });

  it('returns empty for short queries', async () => {
    const result = await searchContent('a', 'es');
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('aggregates results from all sources', async () => {
    mockJsonApiFetch
      .mockResolvedValueOnce({ data: [makeNode('a1', 1, 'Album Test', 'album')], included: [] })
      .mockResolvedValueOnce({ data: [makeNode('ar1', 2, 'Artist Test', 'artista')] })
      .mockResolvedValueOnce({ data: [makeNode('n1', 3, 'News Test', 'noticia')] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    mockFetchAllArtistVideos.mockResolvedValue([
      { id: 'v1', title: 'Video Test', youtubeId: 'abc', thumbnail: null, artistName: 'V Artist', artistHref: '/artista/4', artistNid: 4, url: '' },
    ]);

    const result = await searchContent('test', 'es');
    expect(result.total).toBe(4);
    const types = result.results.map((r) => r.type);
    expect(types).toContain('album');
    expect(types).toContain('artista');
    expect(types).toContain('actualidad');
    expect(types).toContain('video');
  });

  it('handles partial source failures gracefully', async () => {
    mockJsonApiFetch
      .mockRejectedValueOnce(new Error('Albums down'))
      .mockResolvedValueOnce({ data: [makeNode('ar1', 2, 'Artist Test', 'artista')] })
      .mockRejectedValueOnce(new Error('News down'))
      .mockRejectedValueOnce(new Error('Blog down'))
      .mockResolvedValueOnce({ data: [makeNode('b1', 3, 'Blog Test', 'blog')] });

    mockFetchAllArtistVideos.mockResolvedValue([]);

    const result = await searchContent('test', 'es');
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.results.some((r) => r.type === 'artista')).toBe(true);
  });
});
