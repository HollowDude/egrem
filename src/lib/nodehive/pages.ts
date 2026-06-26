import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseButton, parseMediaImage } from './parsers';
import type { NhButton, NhMediaImage, NhEntityMeta } from './parsers';
import type { JsonApiResource } from './client';

export interface NhHero extends NhEntityMeta {
  title: string;
  subtitle: string;
  buttons: NhButton[];
  photo: NhMediaImage | null;
}

export interface NhEslogan extends NhEntityMeta {
  title: string;
}

export interface NhSection extends NhEntityMeta {
  title: string;
  type: string;
}

export interface NhHomePage {
  id: string;
  nodeId: number;
  title: string;
  hero: NhHero | null;
  eslogan: NhEslogan | null;
  sections: NhSection[];
}

export async function fetchHomePage(lang = 'es'): Promise<NhHomePage> {
  const PAGE_UUID = '01c42d09-c898-45d4-9366-98275a2de7fc';

  const res = await jsonApiFetch(
    `node/page/${PAGE_UUID}?include=field_components,field_components.field_buttons,field_components.field_photo`,
    lang,
  );

  const data = res.data as JsonApiResource;
  const included = res.included;

  const componentRels = resolveRelIds(data.relationships?.field_components);

  let hero: NhHero | null = null;
  let eslogan: NhEslogan | null = null;
  const sections: NhSection[] = [];

  for (const ref of componentRels) {
    const comp = findIncluded(included, ref.type, ref.id);
    if (!comp) continue;
    const attrs = comp.attributes as Record<string, unknown>;
    const compType = ref.type.replace('paragraph--', '');

    const internalId = (attrs.drupal_internal__id as number) ?? 0;
    const parentId = (attrs.parent_id as string) ?? '';

    if (compType === '_component_homepage_hero') {
      const buttonRefs = resolveRelIds(comp.relationships?.field_buttons);
      const buttons = buttonRefs
        .map((br) => findIncluded(included, 'paragraph--button', br.id))
        .filter(Boolean)
        .map((b) => parseButton(b!));

      const photoRefs = resolveRelIds(comp.relationships?.field_photo);
      let photo: NhMediaImage | null = null;
      if (photoRefs.length) {
        const mediaRes = findIncluded(included, photoRefs[0].type, photoRefs[0].id);
        if (mediaRes) photo = parseMediaImage(mediaRes, included);
      }

      hero = {
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        subtitle: (attrs.field_subtitle as string) ?? '',
        buttons,
        photo,
      };
    } else if (compType === '_component_homepage_eslogan') {
      eslogan = {
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
      };
    } else {
      sections.push({
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        type: compType,
      });
    }
  }

  const pageAttrs = data.attributes as Record<string, unknown>;

  return {
    id: data.id,
    nodeId: (pageAttrs.drupal_internal__nid as number) ?? 0,
    title: pageAttrs.title as string,
    hero,
    eslogan,
    sections,
  };
}
