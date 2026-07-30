import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());
const mockFetchVideoDetail = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
}));

vi.mock('../youtube', () => ({
  resolveVideoLink: vi.fn(),
  fetchVideoDetail: mockFetchVideoDetail,
}));

vi.mock('../helpers', () => ({
  findIncluded: vi.fn(),
  resolveRelIds: vi.fn(),
  slugify: vi.fn((name: string) =>
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  ),
}));

vi.mock('../parsers', () => ({
  normalizeDrupalUri: vi.fn((uri: string) => uri.replace('internal:', '')),
}));

const mockResolveVideoLink = vi.mocked((await import('../youtube')).resolveVideoLink);

import { fetchAllArtistVideos, fetchVideosCatalogo, fetchVideoDestacado } from '../videos';

describe('fetchAllArtistVideos', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
    mockResolveVideoLink.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchAllArtistVideos('es');
    expect(result).toEqual([]);
  });

  it('returns empty array when no data', async () => {
    mockJsonApiFetch.mockResolvedValue({ data: [] });
    const result = await fetchAllArtistVideos('es');
    expect(result).toEqual([]);
  });

  it('returns video from artist with field_videos_artista', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Test Video',
      youtubeId: 'abc123defgh',
      thumbnail: { url: 'https://example.com/thumb.jpg', alt: '', filename: 'abc123defgh.jpg' },
    });

    const included = [
      { type: 'paragraph--videos_artista', id: 'p1', attributes: { field_url_video: { uri: 'https://www.youtube.com/watch?v=abc123defgh' } } },
    ];

    mockJsonApiFetch.mockResolvedValue({
      data: [
        {
          type: 'node--artista',
          id: 'n1',
          attributes: { title: 'Test Artist', drupal_internal__nid: 42, path: { alias: '/artista/test-artist' } },
          relationships: { field_videos_artista: { data: [{ type: 'paragraph--videos_artista', id: 'p1' }] } },
        },
      ],
      included,
    });

    const { findIncluded } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );

    const { resolveRelIds } = await import('../helpers');
    vi.mocked(resolveRelIds).mockImplementation((rel: { data: unknown } | undefined) => {
      if (!rel?.data) return [];
      return Array.isArray(rel.data) ? rel.data : [rel.data];
    });

    const result = await fetchAllArtistVideos('es');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Video');
    expect(result[0].artistName).toBe('Test Artist');
    expect(result[0].artistNid).toBe(42);
    expect(result[0].artistHref).toBe('/artista/test-artist');
    expect(result[0].youtubeId).toBe('abc123defgh');
  });

  it('deduplicates videos with same youtubeId', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Test Video',
      youtubeId: 'abc123defgh',
      thumbnail: { url: 'https://example.com/thumb.jpg', alt: '', filename: 'abc123defgh.jpg' },
    });

    const included = [
      { type: 'paragraph--videos_artista', id: 'p1', attributes: { field_url_video: { uri: 'https://www.youtube.com/watch?v=abc123defgh' } } },
      { type: 'paragraph--videos_artista', id: 'p2', attributes: { field_url_video: { uri: 'https://youtu.be/abc123defgh' } } },
    ];

    mockJsonApiFetch.mockResolvedValue({
      data: [
        {
          type: 'node--artista',
          id: 'n1',
          attributes: { title: 'Artist A', drupal_internal__nid: 1, path: { alias: null } },
          relationships: { field_videos_artista: { data: [{ type: 'paragraph--videos_artista', id: 'p1' }, { type: 'paragraph--videos_artista', id: 'p2' }] } },
        },
      ],
      included,
    });

    const { findIncluded } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    const { resolveRelIds } = await import('../helpers');
    vi.mocked(resolveRelIds).mockImplementation((rel: { data: unknown[] | unknown } | undefined) => {
      if (!rel?.data) return [];
      return Array.isArray(rel.data) ? rel.data : [rel.data];
    });

    const result = await fetchAllArtistVideos('es');
    expect(result).toHaveLength(1);
  });
});

describe('fetchVideosCatalogo', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
    mockResolveVideoLink.mockReset();
  });

  it('returns empty result on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchVideosCatalogo({}, 'es');
    expect(result.videos).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('filters by artista slug', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Song',
      youtubeId: 'abc123defgh',
      thumbnail: { url: '', alt: '', filename: '' },
    });

    const included = [
      { type: 'paragraph--videos_artista', id: 'p1', attributes: { field_url_video: { uri: 'https://youtube.com/watch?v=abc123defgh' } } },
      { type: 'paragraph--videos_artista', id: 'p2', attributes: { field_url_video: { uri: 'https://youtube.com/watch?v=xyz45678901' } } },
    ];

    mockJsonApiFetch.mockResolvedValue({
      data: [
        {
          type: 'node--artista',
          id: 'n1',
          attributes: { title: 'Artista Uno', drupal_internal__nid: 10, path: { alias: null } },
          relationships: { field_videos_artista: { data: [{ type: 'paragraph--videos_artista', id: 'p1' }] } },
        },
        {
          type: 'node--artista',
          id: 'n2',
          attributes: { title: 'Artista Dos', drupal_internal__nid: 20, path: { alias: null } },
          relationships: { field_videos_artista: { data: [{ type: 'paragraph--videos_artista', id: 'p2' }] } },
        },
      ],
      included,
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation((rel: { data: unknown[] | unknown } | undefined) => {
      if (!rel?.data) return [];
      return Array.isArray(rel.data) ? rel.data : [rel.data];
    });

    const result = await fetchVideosCatalogo({ artista: 'artista-uno' }, 'es');
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].artistName).toBe('Artista Uno');
    expect(result.total).toBe(1);
  });
});

describe('fetchVideoDestacado', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
    mockFetchVideoDetail.mockReset();
  });

  it('returns null on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchVideoDestacado('some-uuid', 'es');
    expect(result).toBeNull();
  });

  it('returns null when no destacado component', async () => {
    mockJsonApiFetch.mockResolvedValue({
      data: { type: 'node--astro_page', id: 'page1', attributes: {} },
      included: [],
    });
    const result = await fetchVideoDestacado('some-uuid', 'es');
    expect(result).toBeNull();
  });
});
