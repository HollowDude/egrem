import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
  getBaseUrlValue: vi.fn(() => 'http://drupal.local'),
}));

import { fetchAlbumesCatalogo } from '../musica';

function albumResource(id: string, attrs: Record<string, unknown>, rels: Record<string, unknown> = {}) {
  return { type: 'node--album', id, attributes: { title: 'Album', field_year: null, path: null, ...attrs }, relationships: rels };
}

const SELLO_UNO = {
  type: 'taxonomy_term--sello_discografico',
  id: 'sello-uno',
  attributes: { name: 'Uno', drupal_internal__tid: 1 },
};

const ARTISTA_A = {
  type: 'node--artista',
  id: 'artista-a',
  attributes: { title: 'Artista A', drupal_internal__nid: 1, path: null },
  relationships: { field_agencia: { data: { type: 'taxonomy_term--agencias', id: 'agencia-1' } } },
};

const ARTISTA_B = {
  type: 'node--artista',
  id: 'artista-b',
  attributes: { title: 'Artista B', drupal_internal__nid: 2, path: null },
  relationships: { field_agencia: { data: { type: 'taxonomy_term--agencias', id: 'agencia-2' } } },
};

const AGENCIA_1 = {
  type: 'taxonomy_term--agencias',
  id: 'agencia-1',
  attributes: { name: 'Son de Cuba' },
};

const AGENCIA_2 = {
  type: 'taxonomy_term--agencias',
  id: 'agencia-2',
  attributes: { name: 'Música' },
};

function albumA(): ReturnType<typeof albumResource> {
  return albumResource(
    'album-a',
    { title: 'Álbum 1962', field_year: 1962, field_album_number: 1, field_artist_name: 'Artista A' },
    {
      field_artista: { data: { type: 'node--artista', id: 'artista-a' } },
      field_interprete: { data: { type: 'node--artista', id: 'artista-a' } },
      field_sello: { data: { type: 'taxonomy_term--sello_discografico', id: 'sello-uno' } },
    },
  );
}

function albumB(): ReturnType<typeof albumResource> {
  return albumResource(
    'album-b',
    { title: 'Álbum 1975', field_year: 1975, field_album_number: 2, field_artist_name: 'Artista B' },
    {
      field_artista: { data: { type: 'node--artista', id: 'artista-b' } },
      field_interprete: { data: { type: 'node--artista', id: 'artista-b' } },
      field_sello: null,
    },
  );
}

function mockResponse(data: ReturnType<typeof albumResource>[]) {
  mockJsonApiFetch.mockResolvedValueOnce({
    data,
    included: [SELLO_UNO, ARTISTA_A, ARTISTA_B, AGENCIA_1, AGENCIA_2],
  });
}

beforeEach(() => {
  mockJsonApiFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAlbumesCatalogo', () => {
  it('returns all albums without filters', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({}, 'es');

    expect(result.total).toBe(2);
    expect(result.albums.length).toBe(2);
    expect(result.availableSellos.map((s) => s.slug)).toContain('uno');
  });

  it('filters by decada', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({ decada: '1960s' }, 'es');

    expect(result.total).toBe(1);
    expect(result.albums[0].id).toBe('album-a');
    expect(result.albums[0].decada).toBe('1960s');
  });

  it('filters by disco number', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({ disco: '2' }, 'es');

    expect(result.total).toBe(1);
    expect(result.albums[0].id).toBe('album-b');
  });

  it('filters by artista', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({ artista: 'artista-a' }, 'es');

    expect(result.total).toBe(1);
    expect(result.albums[0].artista?.slug).toBe('artista-a');
  });

  it('filters by agencia through the artista', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({ agencia: 'musica' }, 'es');

    expect(result.total).toBe(1);
    expect(result.albums[0].id).toBe('album-b');
    expect(result.albums[0].agencia?.name).toBe('Música');
  });

  it('filters by interprete', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({ interprete: 'artista-b' }, 'es');

    expect(result.total).toBe(1);
    expect(result.albums[0].interprete?.slug).toBe('artista-b');
  });

  it('exposes available options from all albums', async () => {
    mockResponse([albumA(), albumB()]);
    const result = await fetchAlbumesCatalogo({}, 'es');

    expect(result.availableDecadas).toEqual(['1960s', '1970s']);
    expect(result.availableDiscos).toEqual(['1', '2']);
    expect(result.availableArtistas.map((a) => a.slug)).toEqual(['artista-a', 'artista-b']);
    expect(result.availableAgencias.map((a) => a.slug)).toEqual(['musica', 'son-de-cuba']);
    expect(result.availableInterpretes.map((i) => i.slug)).toEqual(['artista-a', 'artista-b']);
  });

  it('returns empty result on failure', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    const result = await fetchAlbumesCatalogo({}, 'es');

    expect(result.albums).toEqual([]);
    expect(result.availableDecadas).toEqual([]);
    expect(result.availableDiscos).toEqual([]);
    expect(result.availableArtistas).toEqual([]);
    expect(result.availableAgencias).toEqual([]);
    expect(result.availableInterpretes).toEqual([]);
  });
});
