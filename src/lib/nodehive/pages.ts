import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseButton, parseMediaImage } from './parsers';
import type { NhButton, NhMediaImage, NhEntityMeta } from './parsers';
import type { JsonApiResource } from './client';
import { NODEHIVE_CONFIG } from './config';
import type { NhVideoLink, NhAlbumLink } from '@/types/drupal';

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
  videoLinks: NhVideoLink[];
  albumLinks: NhAlbumLink[];
}

export async function fetchHomePage(lang = 'es'): Promise<NhHomePage> {
  const PAGE_UUID = NODEHIVE_CONFIG.pages.home;

  const res = await jsonApiFetch(
    `node/astro_page/${PAGE_UUID}?include=field_components,field_components.field_buttons,field_components.field_photo,field_components.field_photo.field_media_image,field_components.field_videos,field_components.field_lanzamientos`,
    lang,
  );

  const data = res.data as JsonApiResource;
  const included = res.included;

  const componentRels = resolveRelIds(data.relationships?.field_components);

  let hero: NhHero | null = null;
  let eslogan: NhEslogan | null = null;
  const sections: NhSection[] = [];
  const videoLinks: NhVideoLink[] = [];
  const albumLinks: NhAlbumLink[] = [];

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
    } else if (compType === '_component_homepage_lanzamientos') {
      const albumRefs = resolveRelIds(comp.relationships?.field_lanzamientos);
      for (const ar of albumRefs) {
        const albumComp = findIncluded(included, 'paragraph--homepage_lanzamiento_spotify', ar.id);
        if (!albumComp) continue;
        const aAttrs = albumComp.attributes as Record<string, unknown>;
        const link = aAttrs.field_link as { uri: string; title: string } | null;
        albumLinks.push({
          id: albumComp.id,
          internalId: (aAttrs.drupal_internal__id as number) ?? 0,
          parentId: (aAttrs.parent_id as string) ?? '',
          bundle: 'homepage_lanzamiento_spotify',
          title: link?.title ?? '',
          url: link?.uri ?? '',
        });
      }
      sections.push({
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        type: compType,
      });
    } else if (compType === '_component_homepage_videos') {
      const videoRefs = resolveRelIds(comp.relationships?.field_videos);
      for (const vr of videoRefs) {
        const videoComp = findIncluded(included, 'paragraph--catalogo_video_yt', vr.id);
        if (!videoComp) continue;
        const vAttrs = videoComp.attributes as Record<string, unknown>;
        const link = vAttrs.field_link as { uri: string; title: string } | null;
        videoLinks.push({
          id: videoComp.id,
          internalId: (vAttrs.drupal_internal__id as number) ?? 0,
          parentId: (vAttrs.parent_id as string) ?? '',
          bundle: 'catalogo_video_yt',
          title: link?.title ?? '',
          url: link?.uri ?? '',
        });
      }
      sections.push({
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        type: compType,
      });
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
    videoLinks,
    albumLinks,
  };
}
