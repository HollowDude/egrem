import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhMediaImage, NhEntityMeta } from './parsers';
import type { JsonApiResource } from './client';
import { NODEHIVE_CONFIG } from './config';
import type { NhMisionVision, NhAboutFormHeader } from './entities';

export interface NhAboutHero extends NhEntityMeta {
  title: string;
  subtitle: string;
  tag: string;
  photo: NhMediaImage | null;
}

export async function fetchAboutHero(lang = 'es'): Promise<NhAboutHero | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.about;
    if (!PAGE_UUID) return null;

    const res = await jsonApiFetch(
      `node/astro_page/${PAGE_UUID}?include=field_components,field_components.field_photo,field_components.field_photo.field_media_image`,
      lang,
    );

    const data = res.data as JsonApiResource;
    const included = res.included;
    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const heroRef = componentRefs.find((r) => r.type === 'paragraph--_component_about_hero');
    if (!heroRef) return null;

    const heroComp = findIncluded(included, 'paragraph--_component_about_hero', heroRef.id);
    if (!heroComp) return null;

    const attrs = heroComp.attributes as Record<string, unknown>;

    const photoRefs = resolveRelIds(heroComp.relationships?.field_photo);
    let photo: NhMediaImage | null = null;
    if (photoRefs.length) {
      const mediaRes = findIncluded(included, 'media--image', photoRefs[0].id);
      if (mediaRes) {
        photo = parseMediaImage(mediaRes, included);
        if (photo?.url) photo.url = resolveFileUrl(photo.url);
      }
    }

    return {
      id: heroComp.id,
      internalId: (attrs.drupal_internal__id as number) ?? 0,
      parentId: (attrs.parent_id as string) ?? '',
      bundle: '_component_about_hero',
      title: (attrs.field_title as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
      tag: (attrs.field_tag as string) ?? '',
      photo,
    };
  } catch (e) {
    console.warn('[NodeHive] fetchAboutHero failed:', e);
    return null;
  }
}

export async function fetchAboutMisionVision(lang = 'es'): Promise<NhMisionVision | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.about;
    if (!PAGE_UUID) return null;

    const res = await jsonApiFetch(
      `node/astro_page/${PAGE_UUID}?include=field_components,field_components.field_mision,field_components.field_vision`,
      lang,
    );

    const data = res.data as JsonApiResource;
    const included = res.included;
    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const mvRef = componentRefs.find((r) => r.type === 'paragraph--_component_about_mision_vision');
    if (!mvRef) return null;

    const mvComp = findIncluded(included, 'paragraph--_component_about_mision_vision', mvRef.id);
    if (!mvComp) return null;

    const attrs = mvComp.attributes as Record<string, unknown>;

    let mision: { title: string; body: string } | null = null;
    const misionRefs = resolveRelIds(mvComp.relationships?.field_mision);
    if (misionRefs.length) {
      const mComp = findIncluded(included, 'paragraph--mision_about', misionRefs[0].id);
      if (mComp) {
        const ma = mComp.attributes as Record<string, unknown>;
        mision = {
          title: (ma.field_title as string) ?? '',
          body: (ma.field_subtitle as string) ?? '',
        };
      }
    }

    let vision: { title: string; body: string } | null = null;
    const visionRefs = resolveRelIds(mvComp.relationships?.field_vision);
    if (visionRefs.length) {
      const vComp = findIncluded(included, 'paragraph--vision_about', visionRefs[0].id);
      if (vComp) {
        const va = vComp.attributes as Record<string, unknown>;
        vision = {
          title: (va.field_title as string) ?? '',
          body: (va.field_subtitle as string) ?? '',
        };
      }
    }

    return {
      id: mvComp.id,
      internalId: (attrs.drupal_internal__id as number) ?? 0,
      parentId: (attrs.parent_id as string) ?? '',
      bundle: '_component_about_mision_vision',
      title: (attrs.field_title as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
      mision,
      vision,
    };
  } catch (e) {
    console.warn('[NodeHive] fetchAboutMisionVision failed:', e);
    return null;
  }
}

export async function fetchAboutFormHeader(lang = 'es'): Promise<NhAboutFormHeader | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.about;
    if (!PAGE_UUID) return null;

    const res = await jsonApiFetch(`node/astro_page/${PAGE_UUID}?include=field_components`, lang);

    const data = res.data as JsonApiResource;
    const included = res.included;
    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const formRef = componentRefs.find((r) => r.type === 'paragraph--_component_about_form');
    if (!formRef) return null;

    const formComp = findIncluded(included, 'paragraph--_component_about_form', formRef.id);
    if (!formComp) return null;

    const attrs = formComp.attributes as Record<string, unknown>;

    return {
      id: formComp.id,
      internalId: (attrs.drupal_internal__id as number) ?? 0,
      parentId: (attrs.parent_id as string) ?? '',
      bundle: '_component_about_form',
      title: (attrs.field_title as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
    };
  } catch (e) {
    console.warn('[NodeHive] fetchAboutFormHeader failed:', e);
    return null;
  }
}
