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

const videoNode = (
  overrides: Record<string, unknown> = {},
  relOverrides: Record<string, unknown> = {},
) => ({
  type: 'node--video_yt',
  id: 'v1',
  attributes: {
    title: 'Uno video',
    drupal_internal__nid: 48,
    body: { value: '<p>Es un video</p>' },
    field_link: { uri: 'https://www.youtube.com/watch?v=abc123defgh', title: 'ir a' },
    ...overrides,
  },
  relationships: {
    field_artistas: {
      data: [{ type: 'node--artista', id: 'n1', meta: { drupal_internal__target_id: 7 } }],
    },
    ...relOverrides,
  },
});

const artistNode = {
  type: 'node--artista',
  id: 'n1',
  attributes: {
    title: 'Marisney Elvira',
    drupal_internal__nid: 7,
    path: { alias: null },
  },
};

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

  it('returns video from node/video_yt with field_artistas', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Test Video',
      youtubeId: 'abc123defgh',
      thumbnail: { url: 'https://example.com/thumb.jpg', alt: '', filename: 'abc123defgh.jpg' },
    });

    mockJsonApiFetch.mockResolvedValue({
      data: [videoNode()],
      included: [artistNode],
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
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      'node/video_yt?page[limit]=200&include=field_artistas,field_tipo_video&sort=-created',
      'es',
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Video');
    expect(result[0].artistas).toEqual([{ name: 'Marisney Elvira', href: '/artista/7', nid: 7 }]);
    expect(result[0].body).toBe('<p>Es un video</p>');
    expect(result[0].youtubeId).toBe('abc123defgh');
  });

  it('falls back to link title when oembed has no title', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: '',
      youtubeId: 'abc123defgh',
      thumbnail: { url: '', alt: '', filename: '' },
    });

    mockJsonApiFetch.mockResolvedValue({
      data: [videoNode()],
      included: [artistNode],
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation((rel: { data: unknown } | undefined) => {
      if (!rel?.data) return [];
      return Array.isArray(rel.data) ? rel.data : [rel.data];
    });

    const result = await fetchAllArtistVideos('es');
    expect(result[0].title).toBe('ir a');
  });

  it('deduplicates videos with same youtubeId', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Test Video',
      youtubeId: 'abc123defgh',
      thumbnail: { url: 'https://example.com/thumb.jpg', alt: '', filename: 'abc123defgh.jpg' },
    });

    mockJsonApiFetch.mockResolvedValue({
      data: [
        videoNode(),
        videoNode({
          id: 'v2',
          field_link: { uri: 'https://youtu.be/abc123defgh', title: 'otro' },
        }),
      ],
      included: [artistNode],
    });

    const { findIncluded } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    const { resolveRelIds } = await import('../helpers');
    vi.mocked(resolveRelIds).mockImplementation(
      (rel: { data: unknown[] | unknown } | undefined) => {
        if (!rel?.data) return [];
        return Array.isArray(rel.data) ? rel.data : [rel.data];
      },
    );

    const result = await fetchAllArtistVideos('es');
    expect(result).toHaveLength(1);
  });

  it('skips videos without field_link', async () => {
    mockJsonApiFetch.mockResolvedValue({
      data: [videoNode({ field_link: null })],
      included: [artistNode],
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation((rel: { data: unknown } | undefined) => {
      if (!rel?.data) return [];
      return Array.isArray(rel.data) ? rel.data : [rel.data];
    });

    const result = await fetchAllArtistVideos('es');
    expect(result).toHaveLength(0);
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

  it('filters by artista slug with multivalor artistas', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved
      .mockResolvedValueOnce({
        title: 'Song',
        youtubeId: 'abc123defgh',
        thumbnail: { url: '', alt: '', filename: '' },
      })
      .mockResolvedValueOnce({
        title: 'Otra cancion',
        youtubeId: 'xyz45678901',
        thumbnail: { url: '', alt: '', filename: '' },
      });

    const artistUno = {
      type: 'node--artista',
      id: 'n1',
      attributes: { title: 'Artista Uno', drupal_internal__nid: 10, path: { alias: null } },
    };
    const artistDos = {
      type: 'node--artista',
      id: 'n2',
      attributes: { title: 'Artista Dos', drupal_internal__nid: 20, path: { alias: null } },
    };

    mockJsonApiFetch.mockResolvedValue({
      data: [
        videoNode(),
        videoNode(
          {
            title: 'Otro video',
            drupal_internal__nid: 49,
            body: { value: '' },
            field_link: { uri: 'https://www.youtube.com/watch?v=xyz45678901', title: 'ir' },
          },
          {
            field_artistas: {
              data: [
                { type: 'node--artista', id: 'n1' },
                { type: 'node--artista', id: 'n2' },
              ],
            },
          },
        ),
      ],
      included: [artistUno, artistDos],
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation(
      (rel: { data: unknown[] | unknown } | undefined) => {
        if (!rel?.data) return [];
        return Array.isArray(rel.data) ? rel.data : [rel.data];
      },
    );

    const result = await fetchVideosCatalogo({ artista: 'artista-uno' }, 'es');
    expect(result.videos).toHaveLength(2);
    expect(result.availableArtistas).toEqual(
      expect.arrayContaining([
        { name: 'Artista Uno', slug: 'artista-uno', nid: 10 },
        { name: 'Artista Dos', slug: 'artista-dos', nid: 20 },
      ]),
    );
    expect(result.total).toBe(2);
  });

  it('parses field_tipo_video and exposes availableTipos', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Documental',
      youtubeId: 'abc123defgh',
      thumbnail: { url: '', alt: '', filename: '' },
    });

    const tipoNode = {
      type: 'taxonomy_term--tipo_video',
      id: 'tipo-1',
      attributes: { name: 'Documentales' },
    };

    mockJsonApiFetch.mockResolvedValue({
      data: [
        videoNode(
          {},
          { field_tipo_video: { data: { type: 'taxonomy_term--tipo_video', id: 'tipo-1' } } },
        ),
      ],
      included: [artistNode, tipoNode],
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation(
      (rel: { data: unknown[] | unknown } | undefined) => {
        if (!rel?.data) return [];
        return Array.isArray(rel.data) ? rel.data : [rel.data];
      },
    );

    const result = await fetchVideosCatalogo({}, 'es');
    expect(result.videos[0].tipo).toEqual({ name: 'Documentales', slug: 'documentales' });
    expect(result.availableTipos).toEqual([{ name: 'Documentales', slug: 'documentales' }]);
  });

  it('filters by tipo slug', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved
      .mockResolvedValueOnce({
        title: 'Doc',
        youtubeId: 'abc123defgh',
        thumbnail: { url: '', alt: '', filename: '' },
      })
      .mockResolvedValueOnce({
        title: 'Clip',
        youtubeId: 'xyz45678901',
        thumbnail: { url: '', alt: '', filename: '' },
      });

    const tipoDoc = {
      type: 'taxonomy_term--tipo_video',
      id: 'tipo-1',
      attributes: { name: 'Documentales' },
    };
    const tipoClip = {
      type: 'taxonomy_term--tipo_video',
      id: 'tipo-2',
      attributes: { name: 'Videoclips' },
    };

    mockJsonApiFetch.mockResolvedValue({
      data: [
        videoNode(
          {},
          { field_tipo_video: { data: { type: 'taxonomy_term--tipo_video', id: 'tipo-1' } } },
        ),
        videoNode(
          {
            id: 'v2',
            title: 'Otro video',
            drupal_internal__nid: 49,
            body: { value: '' },
            field_link: { uri: 'https://www.youtube.com/watch?v=xyz45678901', title: 'ir' },
          },
          { field_tipo_video: { data: { type: 'taxonomy_term--tipo_video', id: 'tipo-2' } } },
        ),
      ],
      included: [artistNode, tipoDoc, tipoClip],
    });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation(
      (rel: { data: unknown[] | unknown } | undefined) => {
        if (!rel?.data) return [];
        return Array.isArray(rel.data) ? rel.data : [rel.data];
      },
    );

    const result = await fetchVideosCatalogo({ tipo: 'videoclips' }, 'es');
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].tipo?.slug).toBe('videoclips');
    expect(result.total).toBe(1);
  });

  it('reports hasMore when videos exceed one page', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockImplementation(async (_url: string, raw: string) => {
      const id = raw.match(/v=([\w-]+)/)?.[1] ?? 'yt';
      return { title: 'V', youtubeId: id, thumbnail: { url: '', alt: '', filename: '' } };
    });

    const data = [];
    for (let i = 0; i < 30; i++) {
      data.push(
        videoNode(
          {
            id: `v${i}`,
            title: `Video ${i}`,
            field_link: { uri: `https://www.youtube.com/watch?v=yt${i}${i}${i}`, title: 'ir' },
          },
          { field_tipo_video: null },
        ),
      );
    }

    mockJsonApiFetch.mockResolvedValue({ data, included: [artistNode] });

    const { findIncluded, resolveRelIds } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );
    vi.mocked(resolveRelIds).mockImplementation(
      (rel: { data: unknown[] | unknown } | undefined) => {
        if (!rel?.data) return [];
        return Array.isArray(rel.data) ? rel.data : [rel.data];
      },
    );

    const page1 = await fetchVideosCatalogo({ page: 1 }, 'es');
    expect(page1.videos).toHaveLength(10);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(30);

    const page2 = await fetchVideosCatalogo({ page: 2 }, 'es');
    expect(page2.videos).toHaveLength(10);
    expect(page2.hasMore).toBe(true);
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

  it('returns video from field_video_yt node reference', async () => {
    const mockResolved = vi.mocked(mockResolveVideoLink);
    mockResolved.mockResolvedValue({
      title: 'Destacado Video',
      youtubeId: 'xyz45678901',
      thumbnail: { url: 'https://example.com/dest.jpg', alt: '', filename: 'dest.jpg' },
    });
    mockFetchVideoDetail.mockResolvedValue({
      youtubeId: 'xyz45678901',
      title: 'Destacado Video',
      description: '',
      channelTitle: 'EGREM',
      publishedAt: null,
      viewCount: null,
      thumbnail: null,
    });

    mockJsonApiFetch.mockResolvedValue({
      data: { type: 'node--astro_page', id: 'page1', attributes: {} },
      included: [
        {
          type: 'paragraph--_component_videos_destacado',
          id: 'd1',
          attributes: {},
          relationships: {
            field_video_yt: { data: { type: 'node--video_yt', id: 'v1' } },
          },
        },
        {
          type: 'node--video_yt',
          id: 'v1',
          attributes: {
            title: 'Uno video',
            field_link: { uri: 'https://www.youtube.com/watch?v=xyz45678901', title: 'ir a' },
          },
          relationships: {},
        },
      ],
    });

    const { findIncluded } = await import('../helpers');
    vi.mocked(findIncluded).mockImplementation((inc: unknown[], type: string, id: string) =>
      (inc as Array<{ type: string; id: string }>).find((r) => r.type === type && r.id === id),
    );

    const result = await fetchVideoDestacado('some-uuid', 'es');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      'node/astro_page/some-uuid?include=field_components.field_video_yt',
      'es',
    );
    expect(result).not.toBeNull();
    expect(result?.youtubeId).toBe('xyz45678901');
    expect(result?.title).toBe('Destacado Video');
  });

  it('returns null when destacado has no video reference', async () => {
    mockJsonApiFetch.mockResolvedValue({
      data: { type: 'node--astro_page', id: 'page1', attributes: {} },
      included: [
        {
          type: 'paragraph--_component_videos_destacado',
          id: 'd1',
          attributes: {},
          relationships: { field_video_yt: { data: null } },
        },
      ],
    });

    const result = await fetchVideoDestacado('some-uuid', 'es');
    expect(result).toBeNull();
  });
});
