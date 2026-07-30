import { jsonApiFetch } from './client';
import type { NhSede } from './entities';
import { parseSedeResource } from './sede-parser';

export async function fetchSedes(lang = 'es'): Promise<NhSede[]> {
  try {
    const res = await jsonApiFetch(
      `node/sede?include=field_imagen_representativa,field_imagen_representativa.field_media_image,field_tipo_sede&sort=title`,
      lang,
    );

    const list = Array.isArray(res.data) ? res.data : [res.data].filter(Boolean);
    const included = res.included;

    return list.map((resource) => parseSedeResource(resource, included));
  } catch (e) {
    console.warn('[NodeHive] fetchSedes failed:', e);
    return [];
  }
}
