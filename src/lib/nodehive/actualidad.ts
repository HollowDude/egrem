import type { JsonApiResource, JsonApiResponse } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhMediaImage } from './parsers';
import type { NhActualidadItem, NhActualidadBundle } from './entities';
import { fetchOEmbed } from './youtube';

export interface NhPatrimonioSection {
  videoUrl: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
  videoAuthor: string | null;
  boletines: NhActualidadItem[];
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
  };
}

export async function fetchPatrimonioSection(lang = 'es'): Promise<NhPatrimonioSection | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `paragraph/component_patrimonio_section?include=field_video_destacado,field_boletines_destacados&page[limit]=1`,
      lang,
    );
    const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    if (!items.length) return null;

    const included = res.included ?? [];
    const rels = items[0].relationships ?? {};

    let videoUrl: string | null = null;
    let videoTitle: string | null = null;
    let videoThumbnail: string | null = null;
    let videoAuthor: string | null = null;
    const videoRel = rels.field_video_destacado;
    if (videoRel?.data && !Array.isArray(videoRel.data)) {
      const videoRes = findIncluded(included, 'paragraph--videos_artista', videoRel.data.id);
      if (videoRes) {
        const urlAttr = (videoRes.attributes as Record<string, unknown>).field_url_video as { uri?: string; title?: string } | undefined;
        videoUrl = urlAttr?.uri ?? null;
        if (videoUrl) {
          const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
          if (videoId) {
            const oembed = await fetchOEmbed(videoId);
            videoTitle = oembed?.title ?? urlAttr?.title ?? null;
            videoThumbnail = oembed?.thumbnailUrl ?? null;
            videoAuthor = oembed?.authorName ?? null;
          }
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
        });
      }
    }

    return { videoUrl, videoTitle, videoThumbnail, videoAuthor, boletines };
  } catch (e) {
    console.warn('[NodeHive] Failed to fetch patrimonio section:', e);
    return null;
  }
}

export async function fetchActualidadItems(lang = 'es'): Promise<NhActualidadItem[]> {
  const bundles = ['noticia', 'article', 'blog', 'boletin_archivo'];

  const results = await Promise.allSettled(
    bundles.map((bundle) =>
      jsonApiFetch<RawNodeAttrs>(
        `node/${bundle}?include=field_imagen_o_multimedia,field_imagen_o_multimedia.field_media_image&sort=-created&page[limit]=50`,
        lang,
      ).then((res: JsonApiResponse<RawNodeAttrs>) => ({ bundle, res })),
    ),
  );

  const items: NhActualidadItem[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[NodeHive] Failed to fetch bundle:`, result.reason);
      continue;
    }
    const { res } = result.value;
    const data = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    const included = res.included;

    for (const resource of data) {
      const item = parseItem(resource, included);
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  return items;
}
