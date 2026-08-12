import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
  getBaseUrlValue: vi.fn(() => 'http://drupal.local'),
}));

import { fetchEventosListado, fetchEventoByPath, fetchEventoByNid, parseEventoDetalle, esEventoPasado, fetchEventosHero } from '../eventos';
import type { JsonApiResource } from '../client';

function eventoResource(
  id: string,
  attrs: Record<string, unknown>,
  rels: Record<string, unknown> = {},
): JsonApiResource {
  return {
    type: 'node--evento',
    id,
    attributes: {
      title: 'Festival de Jazz',
      drupal_internal__nid: 100,
      path: null,
      field_fecha: { value: '2026-10-14', end_value: '2026-10-16' },
      field_es_internacional: true,
      body: null,
      ...attrs,
    },
    relationships: rels,
  };
}

const HERO_MEDIA = {
  type: 'media--image',
  id: 'media-hero',
  attributes: { name: 'hero.jpg' },
  relationships: {
    field_media_image: { data: { type: 'file--file', id: 'file-hero' } },
  },
};

const HERO_FILE = {
  type: 'file--file',
  id: 'file-hero',
  attributes: { uri: { url: '/sites/default/files/hero.jpg' }, filename: 'hero.jpg' },
};

const CATEGORIA = {
  type: 'taxonomy_term--tipo_de_evento',
  id: 'cat-1',
  attributes: { name: 'Festival' },
};

const ARTISTA_A = {
  type: 'node--artista',
  id: 'artista-a',
  attributes: { title: 'Marisney Elvira', drupal_internal__nid: 7, path: { alias: '/artista/marisney-elvira' } },
  relationships: {
    field_imagen: { data: { type: 'media--image', id: 'media-art' } },
  },
};

const ARTISTA_MEDIA = {
  type: 'media--image',
  id: 'media-art',
  attributes: { name: 'foto.jpg' },
  relationships: {
    field_media_image: { data: { type: 'file--file', id: 'file-art' } },
  },
};

const ARTISTA_FILE = {
  type: 'file--file',
  id: 'file-art',
  attributes: { uri: { url: '/sites/default/files/foto.jpg' }, filename: 'foto.jpg' },
};

const DIA_1 = {
  type: 'paragraph--evento_dia_programa',
  id: 'dia-1',
  attributes: {
    field_titulo_dia: 'Día 1: Inauguración',
    field_fecha_dia: '2026-10-14',
    field_horario_texto: '18:00 – 02:00',
    field_descripcion_dia: { value: 'Noche de apertura.' },
  },
};

const LINEUP_1 = {
  type: 'paragraph--evento_artista_lineup',
  id: 'lineup-1',
  attributes: { field_rol: 'cabeza_de_cartel' },
  relationships: {
    field_artista: { data: { type: 'node--artista', id: 'artista-a' } },
  },
};

const ENTRADA_1 = {
  type: 'paragraph--evento_tipo_entrada',
  id: 'entrada-1',
  attributes: {
    field_nombre_entrada: 'Pase General',
    field_sku: 'FJZ-GEN',
    field_precio: '25.00',
    field_descripcion_entrada: 'Acceso a un día.',
    field_destacado: true,
  },
  relationships: {
    field_zona_entrada: { data: { type: 'node--zona', id: 'zona-1' } },
  },
};

const ENTRADA_2 = {
  type: 'paragraph--evento_tipo_entrada',
  id: 'entrada-2',
  attributes: {
    field_nombre_entrada: 'VIP Full Pass',
    field_sku: 'FJZ-VIP',
    field_precio: '80.00',
    field_descripcion_entrada: '',
    field_destacado: false,
  },
  relationships: {
    field_zona_entrada: { data: { type: 'node--zona', id: 'zona-2' } },
  },
};

const ZONA_1 = {
  type: 'node--zona',
  id: 'zona-1',
  attributes: { title: 'Zona General', field_capacidad_maxima: 2000 },
};

const ZONA_2 = {
  type: 'node--zona',
  id: 'zona-2',
  attributes: { title: 'Zona VIP', field_capacidad_maxima: 200 },
};

const LOCAL_1 = {
  type: 'node--local',
  id: 'local-1',
  attributes: {
    title: 'Club Habana',
    drupal_internal__nid: 50,
    path: { alias: '/local/club-habana' },
    field_direccion: {
      address_line1: '5ta Avenida e/188 y 192',
      locality: 'La Habana',
      administrative_area: '03',
    },
    field_location: { lat: 23.1104, lon: -82.4046 },
  },
};

beforeEach(() => {
  mockJsonApiFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseEventoDetalle', () => {
  it('parses fecha, hero, categoria, programa, lineup, local y entradas', () => {
    const resource = eventoResource(
      'evt-1',
      {
        field_hora: '20:00',
        body: { value: '<p>Sobre el evento</p>' },
      },
      {
        field_imagen_hero: { data: { type: 'media--image', id: 'media-hero' } },
        field_categoria: { data: { type: 'taxonomy_term--tipo_de_evento', id: 'cat-1' } },
        field_programa: { data: [{ type: 'paragraph--evento_dia_programa', id: 'dia-1' }] },
        field_lineup: { data: [{ type: 'paragraph--evento_artista_lineup', id: 'lineup-1' }] },
        field_venue_bat: { data: { type: 'node--local', id: 'local-1' } },
        field_tipos_entrada: {
          data: [
            { type: 'paragraph--evento_tipo_entrada', id: 'entrada-1' },
            { type: 'paragraph--evento_tipo_entrada', id: 'entrada-2' },
          ],
        },
      },
    );

    const detalle = parseEventoDetalle(resource, [
      HERO_MEDIA,
      HERO_FILE,
      CATEGORIA,
      DIA_1,
      LINEUP_1,
      ARTISTA_A,
      ARTISTA_MEDIA,
      ARTISTA_FILE,
      ENTRADA_1,
      ENTRADA_2,
      ZONA_1,
      ZONA_2,
      LOCAL_1,
    ]);

    expect(detalle.title).toBe('Festival de Jazz');
    expect(detalle.fechaInicio).toBe('2026-10-14');
    expect(detalle.fechaFin).toBe('2026-10-16');
    expect(detalle.hora).toBe('20:00');
    expect(detalle.categoria).toBe('Festival');
    expect(detalle.heroImage?.url).toBe('http://drupal.local/sites/default/files/hero.jpg');
    expect(detalle.esInternacional).toBe(true);
    expect(detalle.href).toBe('/evento/100');

    expect(detalle.local).not.toBeNull();
    expect(detalle.local!.nombre).toBe('Club Habana');
    expect(detalle.local!.direccion).toBe('5ta Avenida e/188 y 192, La Habana, 03');
    expect(detalle.local!.lat).toBe(23.1104);
    expect(detalle.local!.lng).toBe(-82.4046);
    expect(detalle.local!.href).toBe('/local/club-habana');
    expect(detalle.lugarTexto).toBe('Club Habana');

    expect(detalle.programa).toHaveLength(1);
    expect(detalle.programa[0]).toEqual({
      titulo: 'Día 1: Inauguración',
      fecha: '2026-10-14',
      horario: '18:00 – 02:00',
      descripcion: 'Noche de apertura.',
    });

    expect(detalle.lineup).toHaveLength(1);
    expect(detalle.lineup[0].rol).toBe('Cabeza de cartel');
    expect(detalle.lineup[0].artista.name).toBe('Marisney Elvira');
    expect(detalle.lineup[0].artista.href).toBe('/artista/marisney-elvira');
    expect(detalle.lineup[0].artista.imagen?.url).toBe('http://drupal.local/sites/default/files/foto.jpg');

    expect(detalle.tiposEntrada).toHaveLength(2);
    expect(detalle.tiposEntrada[0].precio).toBe(25);
    expect(detalle.tiposEntrada[0].sku).toBe('FJZ-GEN');
    expect(detalle.tiposEntrada[0].capacidad).toBe(2000);
    expect(detalle.tiposEntrada[0].disponibles).toBeNull();
    expect(detalle.tiposEntrada[0].destacado).toBe(true);
    expect(detalle.tiposEntrada[1].capacidad).toBe(200);
    expect(detalle.tiposEntrada[1].destacado).toBe(false);
  });

  it('uses path alias when present and defaults end date to start', () => {
    const resource = eventoResource(
      'evt-2',
      {
        path: { alias: '/eventos/festival-jazz' },
        field_fecha: { value: '2026-11-01', end_value: '2026-11-01' },
      },
      {},
    );
    const detalle = parseEventoDetalle(resource, []);
    expect(detalle.href).toBe('/eventos/festival-jazz');
    expect(detalle.fechaFin).toBe('2026-11-01');
  });

  it('handles a single-day event without programa or lineup', () => {
    const resource = eventoResource('evt-3', { field_fecha: { value: '2026-11-05', end_value: null } }, {});
    const detalle = parseEventoDetalle(resource, []);
    expect(detalle.fechaFin).toBe('2026-11-05');
    expect(detalle.programa).toEqual([]);
    expect(detalle.lineup).toEqual([]);
    expect(detalle.tiposEntrada).toEqual([]);
  });

  it('handles an event without a Local (no venue_bat rel)', () => {
    const resource = eventoResource('evt-4', {}, {});
    const detalle = parseEventoDetalle(resource, []);
    expect(detalle.local).toBeNull();
    expect(detalle.lugarTexto).toBe('');
  });

  it('handles a venue_bat relation with id "missing" (target borrado)', () => {
    const resource = eventoResource(
      'evt-5',
      {},
      { field_venue_bat: { data: { type: 'node--local', id: 'missing' } } },
    );
    const detalle = parseEventoDetalle(resource, []);
    expect(detalle.local).toBeNull();
    expect(detalle.lugarTexto).toBe('');
  });

  it('falls back to local fallback href when no path alias', () => {
    const resource = eventoResource(
      'evt-6',
      {},
      { field_venue_bat: { data: { type: 'node--local', id: 'local-1' } } },
    );
    const LOCAL_SIN_ALIAS = {
      ...LOCAL_1,
      attributes: {
        title: 'El Lugar',
        drupal_internal__nid: 77,
        path: { alias: null },
        field_direccion: null,
        field_location: null,
      },
    };
    const detalle = parseEventoDetalle(resource, [LOCAL_SIN_ALIAS]);
    expect(detalle.local).not.toBeNull();
    expect(detalle.local!.nombre).toBe('El Lugar');
    expect(detalle.local!.direccion).toBe('');
    expect(detalle.local!.lat).toBeNull();
    expect(detalle.local!.lng).toBeNull();
    expect(detalle.local!.href).toBe('/local/77');
    expect(detalle.lugarTexto).toBe('El Lugar');
  });
});

describe('fetchEventosListado', () => {
  it('filters by end date >= today, parses precio desde y agotado', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        eventoResource(
          'evt-1',
          { body: { summary: 'Resumen del evento' } },
          {
            field_imagen_hero: { data: { type: 'media--image', id: 'media-hero' } },
            field_categoria: { data: { type: 'taxonomy_term--tipo_de_evento', id: 'cat-1' } },
            field_tipos_entrada: {
              data: [
                { type: 'paragraph--evento_tipo_entrada', id: 'entrada-1' },
                { type: 'paragraph--evento_tipo_entrada', id: 'entrada-2' },
              ],
            },
          },
        ),
      ],
      included: [HERO_MEDIA, HERO_FILE, CATEGORIA, ENTRADA_1, ENTRADA_2],
    });

    const items = await fetchEventosListado('es');

    expect(items).toHaveLength(1);
    expect(items[0].precioDesde).toBe(25);
    expect(items[0].agotado).toBe(false);
    expect(items[0].categoria).toBe('Festival');
    expect(items[0].descripcionCorta).toBe('Resumen del evento');
    expect(items[0].thumbnail?.url).toBe('http://drupal.local/sites/default/files/hero.jpg');

    const [url] = mockJsonApiFetch.mock.calls[0];
    expect(url).toContain('filter[field_fecha.end_value][value]=');
    expect(url).toContain('filter[field_fecha.end_value][operator]=%3E%3D');
    expect(url).toContain('sort=field_fecha.value');
    expect(url).toContain('field_tipos_entrada.field_zona_entrada');
    expect(url).toContain('field_venue_bat');
  });

  it('does not mark agotado while disponibles is null (Fase 1, pendiente Commerce)', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        eventoResource('evt-x', {}, {
          field_tipos_entrada: {
            data: [
              { type: 'paragraph--evento_tipo_entrada', id: 'entrada-1' },
              { type: 'paragraph--evento_tipo_entrada', id: 'entrada-2' },
            ],
          },
        }),
      ],
      included: [ENTRADA_1, ENTRADA_2, ZONA_1, ZONA_2],
    });

    const items = await fetchEventosListado('es');
    expect(items[0].agotado).toBe(false);
    expect(items[0].precioDesde).toBe(25);
    expect(items[0].lugarTexto).toBe('');
  });

  it('handles events without tipos de entrada (no price, not sold out)', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [eventoResource('evt-y', {}, {})], included: [] });
    const items = await fetchEventosListado('es');
    expect(items[0].precioDesde).toBeNull();
    expect(items[0].agotado).toBe(false);
  });

  it('returns an empty array when the request fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(fetchEventosListado('es')).resolves.toEqual([]);
  });
});

describe('fetchEventoByPath / fetchEventoByNid', () => {
  it('fetches by path alias with full includes', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [eventoResource('evt-1')], included: [] });
    const detalle = await fetchEventoByPath('/eventos/festival-jazz', 'es');
    expect(detalle?.title).toBe('Festival de Jazz');
    const [url] = mockJsonApiFetch.mock.calls[0];
    expect(url).toContain('filter[path.alias][value]=');
    expect(url).toContain('include=field_imagen_hero');
    expect(url).toContain('field_lineup.field_artista.field_imagen.field_media_image');
    expect(url).toContain('field_tipos_entrada.field_zona_entrada');
    expect(url).toContain('field_venue_bat');
  });

  it('fetches by nid', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [eventoResource('evt-1')], included: [] });
    const detalle = await fetchEventoByNid(100, 'es');
    expect(detalle?.title).toBe('Festival de Jazz');
    const [url] = mockJsonApiFetch.mock.calls[0];
    expect(url).toContain('filter[drupal_internal__nid]=100');
  });

  it('returns null when not found', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [], included: [] });
    await expect(fetchEventoByPath('/no-existe', 'es')).resolves.toBeNull();
  });
});

describe('esEventoPasado', () => {
  it('returns true when the event ended before today', () => {
    expect(esEventoPasado('2026-08-01', '2026-08-07')).toBe(true);
  });

  it('returns false when the event ends today or later', () => {
    expect(esEventoPasado('2026-08-07', '2026-08-07')).toBe(false);
    expect(esEventoPasado('2026-08-31', '2026-08-07')).toBe(false);
  });

  it('returns false for empty or malformed dates', () => {
    expect(esEventoPasado('', '2026-08-07')).toBe(false);
    expect(esEventoPasado('no-es-fecha', '2026-08-07')).toBe(false);
    expect(esEventoPasado('2026-08-07', '')).toBe(false);
  });
});

describe('fetchEventosHero', () => {
  const heroResource = {
    type: 'node--astro_page',
    id: 'page-evt',
    attributes: { title: 'Eventos', drupal_internal__nid: 105 },
    relationships: {
      field_components: {
        data: [{ type: 'paragraph--_component_eventos_hero', id: 'hero-1' }],
      },
    },
  };

  it('parses title, subtitle and photo from the hero paragraph', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: heroResource,
      included: [
        {
          type: 'paragraph--_component_eventos_hero',
          id: 'hero-1',
          attributes: {
            drupal_internal__id: 77,
            parent_id: '105',
            field_title: 'Eventos',
            field_subtitle: 'Vibra con nosotros',
          },
          relationships: {
            field_photo: {
              data: [{ type: 'media--image', id: 'media-1' }],
            },
          },
        },
        {
          type: 'media--image',
          id: 'media-1',
          attributes: {
            name: 'hero.jpg',
            field_media_image: { url: '/sites/default/files/hero.jpg' },
          },
          relationships: {
            field_media_image: {
              data: { type: 'file--file', id: 'file-1' },
            },
          },
        },
        {
          type: 'file--file',
          id: 'file-1',
          attributes: { uri: { url: 'http://drupal.local/sites/default/files/hero.jpg' } },
        },
      ],
    });

    const hero = await fetchEventosHero('es');

    expect(hero).not.toBeNull();
    expect(hero!.bundle).toBe('_component_eventos_hero');
    expect(hero!.title).toBe('Eventos');
    expect(hero!.subtitle).toBe('Vibra con nosotros');
    expect(hero!.photo?.url).toContain('hero.jpg');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('node/astro_page/'),
      'es',
    );
  });

  it('returns null when the page has no hero component', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: heroResource,
      included: [],
    });
    await expect(fetchEventosHero('es')).resolves.toBeNull();
  });

  it('returns null when the request fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(fetchEventosHero('es')).resolves.toBeNull();
  });
});
