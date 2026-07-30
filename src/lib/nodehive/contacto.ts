import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseSedeResource } from './sede-parser';
import { NODEHIVE_CONFIG } from './config';
import type { NhContactoPage, NhTipoConsultaOption } from './entities';
import type { JsonApiResource } from './client';

export async function fetchContactoPage(lang = 'es'): Promise<NhContactoPage | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.contacto;
    if (!PAGE_UUID) return null;

    const include = [
      'field_components',
      'field_components.field_sede',
      'field_components.field_sede.field_imagen_representativa',
      'field_components.field_sede.field_imagen_representativa.field_media_image',
    ].join(',');

    const res = await jsonApiFetch(`node/astro_page/${PAGE_UUID}?include=${include}`, lang);

    const data = res.data as JsonApiResource;
    const included = res.included;

    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const contactoRef = componentRefs.find(
      (r) => r.type === 'paragraph--_component_contacto',
    );
    if (!contactoRef) return null;

    const contactoComp = findIncluded(included, 'paragraph--_component_contacto', contactoRef.id);
    if (!contactoComp) return null;

    const attrs = contactoComp.attributes as Record<string, unknown>;

    let sede: NhContactoPage['sede'] = null;
    const sedeRefs = resolveRelIds(contactoComp.relationships?.field_sede);
    if (sedeRefs.length) {
      const sedeRes = findIncluded(included, sedeRefs[0].type, sedeRefs[0].id);
      if (sedeRes) {
        sede = parseSedeResource(sedeRes, included);
      }
    }

    return {
      id: contactoComp.id,
      internalId: (attrs.drupal_internal__id as number) ?? 0,
      parentId: (attrs.parent_id as string) ?? '',
      bundle: '_component_contacto',
      title: (attrs.field_title as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
      sede,
    };
  } catch (e) {
    console.warn('[NodeHive] fetchContactoPage failed:', e);
    return null;
  }
}

export function fetchTipoConsultaOptions(): NhTipoConsultaOption[] {
  return [
    { value: 'general', label_es: 'Información General', label_en: 'General Information' },
    { value: 'licensing', label_es: 'Licencias Comerciales', label_en: 'Commercial Licensing' },
    { value: 'events', label_es: 'Contratación de Eventos', label_en: 'Event Booking' },
    { value: 'support', label_es: 'Soporte Tienda Online', label_en: 'Online Store Support' },
  ];
}
