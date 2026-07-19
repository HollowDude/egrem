import type { JsonApiResource, JsonApiResponse, JsonApiRelationship } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds, slugify } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhMediaImage, NhEntityMeta } from './parsers';
import type {
  NhActualidadItem,
  NhActualidadBundle,
  NhActualidadTag,
  NhActualidadHero,
} from './entities';
import { fetchOEmbed, extractYouTubeId } from './youtube';
import { NODEHIVE_CONFIG } from './config';

export interface NhPatrimonioSection extends NhEntityMeta {
  videoUrl: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
  videoAuthor: string | null;
  videoAvailable: boolean;
  boletines: NhActualidadItem[];
  articuloDestacado: NhActualidadItem | null;
}

interface RawNodeAttrs {
  drupal_internal__nid: number;
  title: string;
  created: string;
  changed: string;
  status: boolean;
  body?: { value: string; summary: string };
  field_autor?: string;
  field_patrimonio?: boolean;
  field_fecha_original?: string;
  path: { alias: string | null };
}

function parseTags(
  resource: { relationships?: Record<string, JsonApiRelationship> },
  included: JsonApiResource[] | undefined,
): NhActualidadTag[] {
  const tagsRel = resource.relationships?.field_tags;
  const tagIds = resolveRelIds(tagsRel);
  return tagIds
    .map((ref) => {
      const term = findIncluded(included, 'taxonomy_term--tags', ref.id);
      if (!term) return null;
      const name = (term.attributes as Record<string, unknown>).name as string;
      if (!name) return null;
      return { slug: slugify(name), label: name };
    })
    .filter((t): t is NhActualidadTag => t !== null);
}

function parseItem(
  resource: JsonApiResource<RawNodeAttrs>,
  included: JsonApiResource[] | undefined,
): NhActualidadItem | null {
  const a = resource.attributes;
  if (!a || !a.status) return null;

  const type = resource.type;
  const bundleMap: Record<string, NhActualidadBundle> = {
    'node--noticia': 'noticia',
    'node--article': 'article',
    'node--blog': 'blog',
    'node--boletin_archivo': 'boletin_archivo',
  };
  const bundle = bundleMap[type];
  if (!bundle) return null;

  const imageRel = resource.relationships?.field_imagen_o_multimedia;
  const imageIds = resolveRelIds(imageRel);
  let image: NhMediaImage | null = null;
  if (imageIds.length > 0) {
    const mediaRes = findIncluded(included, 'media--image', imageIds[0].id);
    if (mediaRes) {
      image = parseMediaImage(mediaRes, included);
      if (image?.url) image.url = resolveFileUrl(image.url);
    }
  }

  let date = a.created;
  if (bundle === 'boletin_archivo' && a.field_fecha_original) {
    date = a.field_fecha_original;
  }

  return {
    id: resource.id,
    nid: a.drupal_internal__nid,
    title: a.title,
    bundle,
    date,
    created: a.created,
    body: a.body?.value ?? '',
    summary: a.body?.summary ?? '',
    author: a.field_autor ?? '',
    patrimonio: a.field_patrimonio ?? false,
    image,
    path: a.path?.alias ?? '',
    tags: parseTags(resource, included),
  };
}

export async function fetchActualidadHero(lang = 'es'): Promise<NhActualidadHero | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.actualidad;
    if (!PAGE_UUID) return null;

    const res = await jsonApiFetch(
      `node/astro_page/${PAGE_UUID}?include=field_components,field_components.field_photo,field_components.field_photo.field_media_image`,
      lang,
    );

    const data = res.data as JsonApiResource;
    const included = res.included;
    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const heroRef = componentRefs.find((r) => r.type === 'paragraph--component_actualidad_hero');
    if (!heroRef) return null;

    const heroComp = findIncluded(included, 'paragraph--component_actualidad_hero', heroRef.id);
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
      bundle: 'component_actualidad_hero',
      title: (attrs.field_titulo as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
      photo,
    };
  } catch (e) {
    console.warn('[NodeHive] Failed to fetch actualidad hero:', e);
    return null;
  }
}

export async function fetchPatrimonioSection(lang = 'es'): Promise<NhPatrimonioSection | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `paragraph/component_patrimonio_section?include=field_video_destacado,field_boletines_destacados,field_articulo_destacado,field_articulo_destacado.field_imagen_o_multimedia,field_articulo_destacado.field_imagen_o_multimedia.field_media_image,field_articulo_destacado.field_tags&page[limit]=1`,
      lang,
    );
    const items = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (!items.length) return null;

    const primera = items[0];
    const included = res.included ?? [];
    const rels = primera.relationships ?? {};
    const entityAttrs = primera.attributes as Record<string, unknown>;

    let videoUrl: string | null = null;
    let videoTitle: string | null = null;
    let videoThumbnail: string | null = null;
    let videoAuthor: string | null = null;
    let videoAvailable = false;
    const videoRel = rels.field_video_destacado;
    if (videoRel?.data && !Array.isArray(videoRel.data)) {
      const videoRes = findIncluded(included, 'paragraph--videos_artista', videoRel.data.id);
      if (videoRes) {
        const urlAttr = (videoRes.attributes as Record<string, unknown>).field_url_video as
          | { uri?: string; title?: string }
          | undefined;
        videoUrl = urlAttr?.uri ?? null;
        const videoId = videoUrl ? extractYouTubeId(videoUrl) : null;
        videoAvailable = Boolean(videoId);
        if (videoId) {
          const oembed = await fetchOEmbed(videoId);
          videoTitle = oembed?.title ?? urlAttr?.title ?? null;
          videoThumbnail = oembed?.thumbnailUrl ?? null;
          videoAuthor = oembed?.authorName ?? null;
        }
      }
    }

    const boletines: NhActualidadItem[] = [];
    const boletinesRel = rels.field_boletines_destacados;
    const boletinIds = resolveRelIds(boletinesRel);
    for (const id of boletinIds) {
      const boletinRes = findIncluded(included, 'node--boletin_archivo', id.id);
      if (boletinRes) {
        const a = boletinRes.attributes as Record<string, unknown>;
        boletines.push({
          id: boletinRes.id,
          nid: (a.drupal_internal__nid as number) ?? 0,
          title: (a.title as string) ?? '',
          bundle: 'boletin_archivo',
          date: (a.field_fecha_original as string) ?? (a.created as string) ?? '',
          created: (a.created as string) ?? '',
          body: '',
          summary: '',
          author: '',
          patrimonio: (a.field_patrimonio as boolean) ?? false,
          image: null,
          path: '',
          tags: [],
        });
      }
    }

    let articuloDestacado: NhActualidadItem | null = null;
    const articuloRel = rels.field_articulo_destacado;
    if (articuloRel?.data && !Array.isArray(articuloRel.data)) {
      const articuloRes = findIncluded(included, 'node--article', articuloRel.data.id);
      if (articuloRes) {
        articuloDestacado = parseItem(
          articuloRes as unknown as JsonApiResource<RawNodeAttrs>,
          included,
        );
      }
    }

    return {
      id: primera.id,
      internalId: (entityAttrs.drupal_internal__id as number) ?? 0,
      parentId: (entityAttrs.parent_id as string) ?? '',
      bundle: 'component_patrimonio_section',
      videoUrl,
      videoTitle,
      videoThumbnail,
      videoAuthor,
      videoAvailable,
      boletines,
      articuloDestacado,
    };
  } catch (e) {
    console.warn('[NodeHive] Failed to fetch patrimonio section:', e);
    return null;
  }
}

export async function fetchActualidadItemPathInLang(
  id: string,
  bundle: NhActualidadBundle,
  lang: string,
): Promise<string | null> {
  try {
    const res = await jsonApiFetch<{ path?: { alias: string | null } }>(
      `node/${bundle}/${id}`,
      lang,
    );
    const data = res.data as JsonApiResource<{ path?: { alias: string | null } }>;
    return data?.attributes?.path?.alias ?? null;
  } catch {
    return null;
  }
}

export function resolveInlineImages(html: string, baseUrl: string): string {
  if (!html) return html;
  return html.replace(/src="\/(?!\/)/g, `src="${baseUrl}/`);
}

export async function fetchActualidadItemByPath(
  path: string,
  lang = 'es',
): Promise<NhActualidadItem | null> {
  let normalized = path.replace(/\/$/, '');
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // ignore decode errors
  }

  const items = await fetchActualidadItems(lang);
  const byPath = items.find((i) => i.path && i.path === normalized);
  if (byPath) return byPath;

  const match = normalized.match(/^\/actualidad\/(noticia|article)\/(\d+)$/);
  if (match) {
    const bundle = match[1] as NhActualidadBundle;
    const nid = match[2];
    return items.find((i) => i.bundle === bundle && String(i.nid) === nid) ?? null;
  }

  return null;
}

export async function fetchActualidadItems(lang = 'es'): Promise<NhActualidadItem[]> {
  const bundleIncludes: Record<string, string> = {
    noticia: 'field_imagen_o_multimedia,field_imagen_o_multimedia.field_media_image,field_tags',
    article: 'field_imagen_o_multimedia,field_imagen_o_multimedia.field_media_image,field_tags',
    blog: 'field_imagen_o_multimedia,field_imagen_o_multimedia.field_media_image,field_tags',
    boletin_archivo: '',
  };

  const results = await Promise.allSettled(
    Object.entries(bundleIncludes).map(([bundle, include]) => {
      const includeParam = include ? `&include=${include}` : '';
      return jsonApiFetch<RawNodeAttrs>(
        `node/${bundle}?sort=-created&page[limit]=50${includeParam}`,
        lang,
      ).then((res: JsonApiResponse<RawNodeAttrs>) => ({ bundle, res }));
    }),
  );

  const items: NhActualidadItem[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[NodeHive] Failed to fetch bundle:`, result.reason);
      continue;
    }
    const { res } = result.value;
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    const included = res.included;

    for (const resource of data) {
      const item = parseItem(resource, included);
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  return items;
}
