import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
  getBaseUrlValue: vi.fn(() => 'http://drupal.local'),
}));

import { fetchLanzamientos, fetchEventos } from '../fetchers';
import type { NhAlbumLink, NhEventoLink } from '../entities';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function albumResource(id: string, attrs: Record<string, unknown>) {
  return {
    type: 'node--album',
    id,
    attributes: {
      title: 'Candela de album',
      drupal_internal__nid: 41,
      path: null,
      ...attrs,
    },
    relationships: {
      field_artista: {
        data: { type: 'node--artista', id: 'art-1' },
      },
      field_imagen_portada: {
        data: { type: 'media--image', id: 'media-1' },
      },
      field_external_apps: {
        data: [
          { type: 'paragraph--external_apps', id: 'app-1' },
          { type: 'paragraph--external_apps', id: 'app-2' },
        ],
      },
    },
  };
}

function albumIncludes() {
  return [
    {
      type: 'node--artista',
      id: 'art-1',
      attributes: { title: 'Sonora Matancera' },
    },
    {
      type: 'media--image',
      id: 'media-1',
      attributes: {
        name: 'portada.jpg',
        field_media_image: { url: '/sites/default/files/portada.jpg' },
      },
      relationships: {
        field_media_image: { data: { type: 'file--file', id: 'file-1' } },
      },
    },
    {
      type: 'file--file',
      id: 'file-1',
      attributes: { uri: { url: 'http://drupal.local/sites/default/files/portada.jpg' } },
    },
    {
      type: 'paragraph--external_apps',
      id: 'app-1',
      attributes: {
        field_titulo: 'Spotify',
        field_app_link: {
          uri: 'https://open.spotify.com/intl-es/album/7vI4iTxDmgEN63liQHPEX1',
          title: 'Ir a',
        },
      },
    },
    {
      type: 'paragraph--external_apps',
      id: 'app-2',
      attributes: {
        field_titulo: 'IMusic',
        field_app_link: {
          uri: 'https://music.apple.com/cr/album/follow-you/1557714984',
          title: 'Ir a',
        },
      },
    },
  ];
}

beforeEach(() => {
  mockJsonApiFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchLanzamientos — nodos album reales', () => {
  it('resolves a node--album reference with artist, cover, spotify embed and iMusic external link', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: albumResource('alb-1', {}),
      included: albumIncludes(),
    });

    const links: NhAlbumLink[] = [
      { id: 'alb-1', internalId: 0, parentId: 'comp-1', bundle: 'album', title: '', url: '' },
    ];

    const albums = await fetchLanzamientos(links, 'es');

    expect(albums).toHaveLength(1);
    const album = albums[0];
    expect(album.bundle).toBe('album');
    expect(album.title).toBe('Candela de album');
    expect(album.artist).toBe('Sonora Matancera');
    expect(album.cover?.url).toContain('portada.jpg');
    expect(album.spotifyId).toBe('7vI4iTxDmgEN63liQHPEX1');
    expect(album.embedUrl).toBe('https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1');
    expect(album.externalApp).toEqual({
      title: 'IMusic',
      url: 'https://music.apple.com/cr/album/follow-you/1557714984',
      platform: 'apple_music',
    });
    expect(album.href).toBe('/catalogo/musica/41');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('node/album/alb-1'),
      'es',
    );
  });

  it('falls back to the album detail page when there are no platform links', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: albumResource('alb-1', {}),
      included: albumIncludes().slice(0, 3),
    });

    const albums = await fetchLanzamientos(
      [{ id: 'alb-1', internalId: 0, parentId: '', bundle: 'album', title: '', url: '' }],
      'es',
    );

    expect(albums[0].embedUrl).toBe('');
    expect(albums[0].externalApp).toBeNull();
    expect(albums[0].href).toBe('/catalogo/musica/41');
  });

  it('skips album references that fail to resolve', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    const albums = await fetchLanzamientos(
      [{ id: 'alb-1', internalId: 0, parentId: '', bundle: 'album', title: '', url: '' }],
      'es',
    );
    expect(albums).toHaveLength(0);
  });
});

describe('fetchLanzamientos — sin referencias usa los últimos álbumes', () => {
  it('fetches the latest albums from Drupal', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        albumResource('alb-1', {}),
        albumResource('alb-2', { title: 'Single', drupal_internal__nid: 99 }),
      ],
      included: albumIncludes(),
    });

    const albums = await fetchLanzamientos([], 'es');

    expect(albums).toHaveLength(2);
    expect(albums[0].title).toBe('Candela de album');
    expect(albums[1].title).toBe('Single');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('node/album?sort=-created'),
      'es',
    );
  });

  it('returns an empty array when the fetch fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(fetchLanzamientos([], 'es')).resolves.toEqual([]);
  });
});

describe('fetchLanzamientos — legacy paragraph homepage_lanzamiento_spotify', () => {
  it('resolves the spotify link via oEmbed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        title: 'Salsa Brava',
        thumbnail_url: 'https://i.scdn.co/image/abc',
        html: '<iframe></iframe>',
        iframe_url: 'https://open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1',
      }),
    );

    const albums = await fetchLanzamientos(
      [
        {
          id: 'para-1',
          internalId: 16,
          parentId: 'comp-1',
          bundle: 'homepage_lanzamiento_spotify',
          title: 'Salsa Brava',
          url: 'https://open.spotify.com/intl-es/album/7vI4iTxDmgEN63liQHPEX1',
        },
      ],
      'es',
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('Salsa Brava');
    expect(albums[0].embedUrl).toContain('open.spotify.com/embed/album/7vI4iTxDmgEN63liQHPEX1');
    expect(albums[0].spotifyId).toBe('7vI4iTxDmgEN63liQHPEX1');
  });
});

/* ─── Eventos de la home (referencias node--evento) ───────────── */

function eventoResource(id: string, nid: number, attrs: Record<string, unknown>) {
  return {
    type: 'node--evento',
    id,
    attributes: {
      title: 'Festival de Jazz',
      drupal_internal__nid: nid,
      path: null,
      field_fecha: { value: '2026-08-14', end_value: '2026-08-16' },
      field_hora: '20:00',
      field_lugar: 'Teatro América, La Habana',
      ...attrs,
    },
  };
}

describe('fetchEventos — referencias node--evento de la home', () => {
  it('resolves the referenced evento nodes by uuid', async () => {
    mockJsonApiFetch
      .mockResolvedValueOnce({
        data: eventoResource('ev-1', 101, { title: 'Festival Rumba 2026' }),
      })
      .mockResolvedValueOnce({
        data: eventoResource('ev-2', 102, {
          title: 'Noche de Boleros',
          field_fecha: '2026-08-20',
          path: { alias: '/eventos/noche-de-boleros' },
        }),
      });

    const links: NhEventoLink[] = [
      { id: 'ev-1', internalId: 0, parentId: 'comp-1', bundle: 'evento' },
      { id: 'ev-2', internalId: 0, parentId: 'comp-1', bundle: 'evento' },
    ];

    const eventos = await fetchEventos(links, 'es');

    expect(eventos).toHaveLength(2);
    expect(eventos[0].title).toBe('Festival Rumba 2026');
    expect(eventos[0].venue).toBe('Teatro América, La Habana');
    expect(eventos[0].date).toBe('2026-08-14');
    expect(eventos[0].endDate).toBe('2026-08-16');
    expect(eventos[0].time).toBe('20:00');
    expect(eventos[0].href).toBe('/evento/101');
    expect(eventos[1].title).toBe('Noche de Boleros');
    expect(eventos[1].href).toBe('/eventos/noche-de-boleros');
    expect(mockJsonApiFetch).toHaveBeenNthCalledWith(1, 'node/evento/ev-1', 'es');
    expect(mockJsonApiFetch).toHaveBeenNthCalledWith(2, 'node/evento/ev-2', 'es');
  });

  it('skips references that fail to resolve', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    const eventos = await fetchEventos(
      [{ id: 'ev-1', internalId: 0, parentId: '', bundle: 'evento' }],
      'es',
    );
    expect(eventos).toHaveLength(0);
  });
});

describe('fetchEventos — sin referencias usa los próximos eventos', () => {
  it('fetches the next eventos from Drupal', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [eventoResource('ev-1', 101, {}), eventoResource('ev-2', 102, {})],
    });

    const eventos = await fetchEventos([], 'es');

    expect(eventos).toHaveLength(2);
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('node/evento?sort=field_fecha.value'),
      'es',
    );
  });

  it('returns an empty array when the fetch fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(fetchEventos([], 'es')).resolves.toEqual([]);
  });
});
