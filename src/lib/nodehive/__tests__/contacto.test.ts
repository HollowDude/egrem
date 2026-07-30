import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('contacto', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NODEHIVE_BASE_URL', 'https://example.com');
    vi.stubEnv('NODEHIVE_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('fetchTipoConsultaOptions', () => {
    it('should return the expected options', async () => {
      const { fetchTipoConsultaOptions } = await import('../contacto');
      const options = fetchTipoConsultaOptions();

      expect(options).toHaveLength(4);
      expect(options[0].value).toBe('general');
      expect(options[0].label_es).toBe('Información General');
      expect(options[0].label_en).toBe('General Information');
      expect(options[1].value).toBe('licensing');
      expect(options[2].value).toBe('events');
      expect(options[3].value).toBe('support');
    });
  });

  describe('fetchContactoPage', () => {
    it('should parse the contacto page correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            type: 'node--astro_page',
            id: 'page-1',
            attributes: { title: 'Contacto' },
            relationships: {
              field_components: {
                data: [{ type: 'paragraph--_component_contacto', id: 'comp-1' }],
              },
            },
          },
          included: [
            {
              type: 'paragraph--_component_contacto',
              id: 'comp-1',
              attributes: {
                drupal_internal__id: 1,
                parent_id: 'page-1',
                field_title: 'Contacto',
                field_subtitle: 'Estamos aquí para escucharle.',
              },
              relationships: {
                field_sede: {
                  data: { type: 'node--sede', id: 'sede-1' },
                },
              },
            },
            {
              type: 'node--sede',
              id: 'sede-1',
              attributes: {
                title: 'Sede Principal',
                field_direccion: {
                  address_line1: 'Calle 3ra No. 1008',
                  locality: 'Playa',
                  administrative_area: '03',
                  country_code: 'CU',
                },
                field_location: { lat: 23.0842, lon: -82.4068 },
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
                field_tipo_sede: { data: null },
              },
            },
          ],
        }),
      });

      const { fetchContactoPage } = await import('../contacto');
      const result = await fetchContactoPage('es');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Contacto');
      expect(result!.subtitle).toBe('Estamos aquí para escucharle.');
      expect(result!.bundle).toBe('_component_contacto');
      expect(result!.sede).not.toBeNull();
      expect(result!.sede!.title).toBe('Sede Principal');
      expect(result!.sede!.direccion?.address_line1).toBe('Calle 3ra No. 1008');
      expect(result!.sede!.telefono[0].phone_number).toBe('+53 7 204 9822');
      expect(result!.sede!.correo).toBe('info@egrem.co.cu');
    });

    it('should return null when page UUID is not configured', async () => {
      const { fetchContactoPage } = await import('../contacto');
      const result = await fetchContactoPage('es');
      expect(result).toBeNull();
    });

    it('should return null when contacto component is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            type: 'node--astro_page',
            id: 'page-1',
            attributes: { title: 'Contacto' },
            relationships: {
              field_components: {
                data: [{ type: 'paragraph--_component_about_hero', id: 'comp-1' }],
              },
            },
          },
          included: [],
        }),
      });

      const { fetchContactoPage } = await import('../contacto');
      const result = await fetchContactoPage('es');
      expect(result).toBeNull();
    });

    it('should handle API error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { fetchContactoPage } = await import('../contacto');
      const result = await fetchContactoPage('es');

      expect(result).toBeNull();
    });
  });

  describe('parseSedeResource (via sede-parser)', () => {
    it('should parse a sede resource standalone', async () => {
      const { parseSedeResource } = await import('../sede-parser');

      const resource = {
        type: 'node--sede',
        id: 'sede-test',
        attributes: {
          title: 'Test Sede',
          field_direccion: {
            address_line1: 'Test Address',
            locality: 'Test City',
            administrative_area: '99',
            country_code: 'CU',
          },
          field_location: { lat: 23.0, lon: -82.0, geo_type: 'point', value: '' },
          field_telefono: [
            { phone_number: '+53 5 555 5555', country_code: '53', local_number: '55555555' },
          ],
          field_correo_electronico: 'test@test.com',
          field_horario_de_atencion: {
            value: '2024-01-01T09:00:00',
            end_value: '2024-01-01T18:00:00',
          },
        },
        relationships: {
          field_imagen_representativa: { data: null },
          field_tipo_sede: { data: null },
        },
      };

      const result = parseSedeResource(resource, []);

      expect(result.title).toBe('Test Sede');
      expect(result.direccion?.address_line1).toBe('Test Address');
      expect(result.location?.lat).toBe(23.0);
      expect(result.telefono).toHaveLength(1);
      expect(result.telefono[0].phone_number).toBe('+53 5 555 5555');
      expect(result.correo).toBe('test@test.com');
      expect(result.horario?.value).toBe('2024-01-01T09:00:00');
      expect(result.imagen).toBeNull();
      expect(result.tipo).toBeNull();
    });
  });
});
