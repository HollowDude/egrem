import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
}));

vi.mock('../youtube', () => ({
  resolveVideoLink: vi.fn(),
}));

import { fetchArtistas, fetchArtistaByPath, fetchArtistaByNid, fetchVideosByArtista } from '../artistas';

const mockResolveVideoLink = vi.mocked((await import('../youtube')).resolveVideoLink);

type MockResource = { type: string; id: string; attributes: Record<string, unknown> };

function mockFindIncluded(included: MockResource[], type: string, id: string): MockResource | undefined {
  return included?.find((r) => r.type === type && r.id === id);
}

type MockRelResource = { relationships?: Record<string, { data: { type: string; id: string } | unknown[] | null }> };

describe('parseAgencia (internal)', () => {
  it('returns agency data from relationship', () => {
    const included: MockResource[] = [
      { type: 'taxonomy_term--agencias', id: 'ag1', attributes: { name: 'Música', drupal_internal__tid: 1 } },
    ];
    const resource: MockRelResource = {
      relationships: {
        field_agencia: { data: { type: 'taxonomy_term--agencias', id: 'ag1' } },
      },
    };

    const rel = (resource.relationships?.field_agencia?.data as { type: string; id: string });
    const term = mockFindIncluded(included, 'taxonomy_term--agencias', rel.id);
    const a = term!.attributes;
    const result = {
      name: a.name as string,
      slug: (a.name as string).toLowerCase().replace(/\s+/g, '-'),
      tid: a.drupal_internal__tid as number,
    };

    expect(result.name).toBe('Música');
    expect(result.slug).toBe('música');
    expect(result.tid).toBe(1);
  });

  it('returns undefined when no relationship', () => {
    const resource: MockRelResource = { relationships: {} };
    expect(resource.relationships?.field_agencia).toBeUndefined();
  });

  it('returns undefined when relationship data is array', () => {
    const resource: MockRelResource = {
      relationships: { field_agencia: { data: [] as unknown[] } },
    };
    expect(Array.isArray(resource.relationships.field_agencia.data)).toBe(true);
  });
});

describe('fetchArtistas error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistas('es');
    expect(result).toEqual([]);
  });
});

describe('fetchArtistaByPath error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns null on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistaByPath('/test', 'es');
    expect(result).toBeNull();
  });
});

describe('fetchArtistaByNid error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns null on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistaByNid(999, 'es');
    expect(result).toBeNull();
  });

  it('returns null when no results match', async () => {
    mockJsonApiFetch.mockResolvedValue({ data: [] as unknown[] });
    const result = await fetchArtistaByNid(999, 'es');
    expect(result).toBeNull();
  });
});

describe('fetchVideosByArtista', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
    mockResolveVideoLink.mockReset();
  });

  it('returns empty array when no artistaId', async () => {
    const result = await fetchVideosByArtista('', 'es');
    expect(result).toEqual([]);
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchVideosByArtista('uuid-1', 'es');
    expect(result).toEqual([]);
  });

  it('fetches node/video_yt filtered by field_artistas.id', async () => {
    mockResolveVideoLink.mockResolvedValue({
      title: 'Video del artista',
      youtubeId: 'abc123defgh',
      thumbnail: { url: 'https://example.com/thumb.jpg', alt: '', filename: 'thumb.jpg' },
    });

    mockJsonApiFetch.mockResolvedValue({
      data: [
        {
          type: 'node--video_yt',
          id: 'v1',
          attributes: {
            title: 'Uno video',
            field_link: { uri: 'https://www.youtube.com/watch?v=abc123defgh', title: 'ir a' },
          },
          relationships: {},
        },
      ],
      included: [],
    });

    const result = await fetchVideosByArtista('dae2e5e1-8f21-444a-93c5-c45671ef4441', 'es');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      'node/video_yt?filter[field_artistas.id][value]=dae2e5e1-8f21-444a-93c5-c45671ef4441&sort=-created',
      'es',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'v1',
      url: 'https://www.youtube.com/watch?v=abc123defgh',
      youtubeId: 'abc123defgh',
      title: 'Video del artista',
      thumbnail: 'https://example.com/thumb.jpg',
    });
  });

  it('falls back to node title when oembed has no title', async () => {
    mockResolveVideoLink.mockResolvedValue({
      title: '',
      youtubeId: 'abc123defgh',
      thumbnail: { url: '', alt: '', filename: '' },
    });

    mockJsonApiFetch.mockResolvedValue({
      data: [
        {
          type: 'node--video_yt',
          id: 'v1',
          attributes: {
            title: 'Uno video',
            field_link: { uri: 'https://www.youtube.com/watch?v=abc123defgh', title: '' },
          },
          relationships: {},
        },
      ],
      included: [],
    });

    const result = await fetchVideosByArtista('uuid-1', 'es');
    expect(result[0].title).toBe('Uno video');
  });
});
