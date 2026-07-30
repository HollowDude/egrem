import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const ORIGINAL_ENV = process.env;

describe('fetchSedes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NODEHIVE_BASE_URL', 'https://example.com');
    vi.stubEnv('NODEHIVE_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should parse sede data correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            type: 'node--sede',
            id: 'sede-1',
            attributes: {
              title: 'Sede Central EGREM',
              field_direccion: {
                address_line1: 'Calle 3ra No. 1008',
                locality: 'Playa',
                administrative_area: '03',
                country_code: 'CU',
              },
              field_location: {
                lat: 23.0842,
                lon: -82.4068,
                geo_type: 'point',
                value: 'POINT (-82.4068 23.0842)',
              },
              field_telefono: [
                { phone_number: '+53 7 204 9822', country_code: '53', local_number: '72049822' },
              ],
              field_correo_electronico: 'info@egrem.co.cu',
              field_horario_de_atencion: {
                value: '2024-01-01T08:30:00',
                end_value: '2024-01-01T17:00:00',
              },
            },
            relationships: {
              field_imagen_representativa: { data: null },
              field_tipo_sede: {
                data: { type: 'taxonomy_term--tipo_de_sede', id: 'tipo-1' },
              },
            },
          },
        ],
        included: [
          {
            type: 'taxonomy_term--tipo_de_sede',
            id: 'tipo-1',
            attributes: {
              name: 'Oficina Central',
              drupal_internal__tid: 1,
            },
          },
        ],
      }),
    });

    const { fetchSedes } = await import('../sedes');
    const result = await fetchSedes('es');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Sede Central EGREM');
    expect(result[0].direccion?.address_line1).toBe('Calle 3ra No. 1008');
    expect(result[0].direccion?.administrative_area).toBe('03');
    expect(result[0].location?.lat).toBe(23.0842);
    expect(result[0].location?.lon).toBe(-82.4068);
    expect(result[0].telefono).toHaveLength(1);
    expect(result[0].telefono[0].phone_number).toBe('+53 7 204 9822');
    expect(result[0].correo).toBe('info@egrem.co.cu');
    expect(result[0].horario?.value).toBe('2024-01-01T08:30:00');
    expect(result[0].tipo?.name).toBe('Oficina Central');
    expect(result[0].tipo?.tid).toBe(1);
  });

  it('should return empty array when no sedes exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        included: [],
      }),
    });

    const { fetchSedes } = await import('../sedes');
    const result = await fetchSedes('es');

    expect(result).toEqual([]);
  });

  it('should handle missing optional fields gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            type: 'node--sede',
            id: 'sede-2',
            attributes: {
              title: 'Sede minimal',
              field_direccion: null,
              field_location: null,
              field_telefono: null,
              field_correo_electronico: '',
              field_horario_de_atencion: null,
            },
            relationships: {
              field_imagen_representativa: { data: null },
              field_tipo_sede: { data: null },
            },
          },
        ],
        included: [],
      }),
    });

    const { fetchSedes } = await import('../sedes');
    const result = await fetchSedes('es');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Sede minimal');
    expect(result[0].direccion).toBeNull();
    expect(result[0].location).toBeNull();
    expect(result[0].telefono).toEqual([]);
    expect(result[0].correo).toBe('');
    expect(result[0].horario).toBeNull();
    expect(result[0].tipo).toBeNull();
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { fetchSedes } = await import('../sedes');
    const result = await fetchSedes('es');

    expect(result).toEqual([]);
  });
});
