import type { JsonApiResource } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhSede, NhSedeAddress, NhSedePhone } from './entities';

export function parseAddress(raw: unknown): NhSedeAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    address_line1: (r.address_line1 as string) ?? '',
    locality: (r.locality as string) ?? '',
    administrative_area: (r.administrative_area as string) ?? '',
    country_code: (r.country_code as string) ?? '',
  };
}

function parseGeoField(raw: unknown): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = r.lat as number | undefined;
  const lon = r.lon as number | undefined;
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

export function parsePhoneList(raw: unknown): NhSedePhone[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== 'object')
      return { phone_number: '', country_code: '', local_number: '' };
    const i = item as Record<string, unknown>;
    return {
      phone_number: (i.phone_number as string) ?? '',
      country_code: (i.country_code as string) ?? '',
      local_number: (i.local_number as string) ?? '',
    };
  });
}

export function parseHorario(raw: unknown): { value: string; end_value: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const value = r.value as string | undefined;
  if (!value) return null;
  return { value, end_value: (r.end_value as string) ?? '' };
}

export function parseSedeResource(
  resource: JsonApiResource,
  included: JsonApiResource[] | undefined,
): NhSede {
  const a = resource.attributes as Record<string, unknown>;

  let imagen: ReturnType<typeof parseMediaImage> = null;
  const imgRefs = resolveRelIds(resource.relationships?.field_imagen_representativa);
  if (imgRefs.length) {
    const mediaRes = findIncluded(included, imgRefs[0].type, imgRefs[0].id);
    if (mediaRes) {
      imagen = parseMediaImage(mediaRes, included);
      if (imagen?.url) imagen.url = resolveFileUrl(imagen.url);
    }
  }

  let tipo: { name: string; tid: number } | null = null;
  const tipoRefs = resolveRelIds(resource.relationships?.field_tipo_sede);
  if (tipoRefs.length) {
    const termRes = findIncluded(included, tipoRefs[0].type, tipoRefs[0].id);
    if (termRes) {
      const ta = termRes.attributes as Record<string, unknown>;
      tipo = {
        name: (ta.name as string) ?? '',
        tid: (ta.drupal_internal__tid as number) ?? 0,
      };
    }
  }

  return {
    id: resource.id,
    title: (a.title as string) ?? '',
    direccion: parseAddress(a.field_direccion),
    location: parseGeoField(a.field_location),
    telefono: parsePhoneList(a.field_telefono),
    correo: (a.field_correo_electronico as string) ?? '',
    horario: parseHorario(a.field_horario_de_atencion),
    imagen,
    tipo,
  };
}
