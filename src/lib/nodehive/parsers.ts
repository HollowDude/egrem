import type { JsonApiResource } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { getBaseUrlValue } from './client';

export function normalizeDrupalUri(uri: string | undefined | null): string {
  if (!uri) return '#';
  if (uri.startsWith('internal:/')) {
    return uri.slice('internal:'.length);
  }
  if (uri.startsWith('entity:')) {
    const rest = uri.slice('entity:'.length);
    return `/${rest.replace(/:/g, '/')}`;
  }
  if (uri.startsWith('route:') || uri.startsWith('<')) {
    return '#';
  }
  return uri;
}

export interface NhLink {
  uri: string;
  title: string;
}

export interface NhMediaImage {
  url: string;
  alt: string;
  filename: string;
}

export interface NhButton {
  id: string;
  title: string;
  style: 'primary' | 'secondary';
  link: NhLink | null;
}

export interface NhEntityMeta {
  id: string;
  internalId: number;
  parentId: string;
  bundle: string;
}

export interface NhBase {
  id: string;
}

export function parseButton(res: JsonApiResource): NhButton {
  const a = res.attributes as Record<string, unknown>;
  const link = a.field_link as { uri: string; title: string } | null;
  return {
    id: res.id,
    title: (a.field_title as string) ?? '',
    style:
      ((a.field_style === 'secundary' ? 'secondary' : a.field_style) as 'primary' | 'secondary') ??
      'primary',
    link: link ? { uri: normalizeDrupalUri(link.uri), title: link.title ?? '' } : null,
  };
}

export function parseMediaImage(
  mediaRes: JsonApiResource,
  included: JsonApiResource[] | undefined,
): NhMediaImage | null {
  const fileRel = mediaRes.relationships?.field_media_image;
  const fileIds = resolveRelIds(fileRel);
  if (!fileIds.length) return null;
  const fileRes = findIncluded(included, 'file--file', fileIds[0].id);
  if (!fileRes) return null;
  const attrs = fileRes.attributes as Record<string, unknown>;
  const uri = attrs.uri as { url?: string } | undefined;
  return {
    url: resolveFileUrl(uri?.url ?? ''),
    alt: ((mediaRes.attributes as Record<string, unknown>).name as string) ?? '',
    filename: (attrs.filename as string) ?? '',
  };
}

export interface NhMediaFile {
  url: string;
  filename: string;
  title: string;
}

export function parseMediaDocument(
  mediaRes: JsonApiResource,
  included: JsonApiResource[] | undefined,
): NhMediaFile | null {
  const fileRel = mediaRes.relationships?.field_media_document;
  const fileIds = resolveRelIds(fileRel);
  if (!fileIds.length) return null;
  const fileRes = findIncluded(included, 'file--file', fileIds[0].id);
  if (!fileRes) return null;
  const attrs = fileRes.attributes as Record<string, unknown>;
  const uri = attrs.uri as { url?: string } | undefined;
  return {
    url: uri?.url ?? '',
    filename: (attrs.filename as string) ?? '',
    title: ((mediaRes.attributes as Record<string, unknown>).name as string) ?? '',
  };
}

export interface NhMediaVideo {
  url: string;
  filename: string;
  mime: string;
}

export interface NhRemoteVideo {
  url: string;
  youtubeId: string | null;
  thumbnail: string | null;
  title: string;
}

export function parseMediaVideo(
  mediaRes: JsonApiResource,
  included: JsonApiResource[] | undefined,
): NhMediaVideo | null {
  const fileRel = mediaRes.relationships?.field_media_video_file;
  const fileIds = resolveRelIds(fileRel);
  if (!fileIds.length) return null;
  const fileRes = findIncluded(included, 'file--file', fileIds[0].id);
  if (!fileRes) return null;
  const attrs = fileRes.attributes as Record<string, unknown>;
  const uri = attrs.uri as { url?: string } | undefined;
  return {
    url: uri?.url ?? '',
    filename: (attrs.filename as string) ?? '',
    mime: (attrs.filemime as string) ?? '',
  };
}

export function resolveFileUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getBaseUrlValue()}${path}`;
}
