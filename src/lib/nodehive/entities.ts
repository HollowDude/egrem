import type { NhBase, NhMediaImage, NhEntityMeta } from './parsers';

export interface NhLoginRight extends NhBase, NhEntityMeta {
  title: string;
  subtitle: string;
  phrase: string;
  photo: NhMediaImage | null;
}

export interface NhLoginPage {
  id: string;
  nodeId: number;
  title: string;
  right: NhLoginRight | null;
}

export interface NhNoticia extends NhBase {
  title: string;
  excerpt: string;
  category: string;
  image: NhMediaImage | null;
  href: string;
  date: string;
}

export interface NhEvento extends NhBase {
  title: string;
  venue: string;
  date: string;
  time: string;
  href: string;
}

export interface NhAlbumLink {
  id: string;
  internalId: number;
  parentId: string;
  bundle: string;
  title: string;
  url: string;
}

export interface NhAlbum extends NhBase {
  title: string;
  artist?: string;
  cover: NhMediaImage | null;
  href: string;
  spotifyId: string | null;
  embedUrl: string;
  format?: string;
  price?: string;
  internalId?: number;
  parentId?: string;
  bundle?: string;
}

export interface NhVideoLink {
  id: string;
  internalId: number;
  parentId: string;
  bundle: string;
  title: string;
  url: string;
}

export interface NhVideo extends NhBase {
  title: string;
  thumbnail: NhMediaImage | null;
  href: string;
  youtubeId: string | null;
  internalId?: number;
  parentId?: string;
  bundle?: string;
}

export interface NhProduccion extends NhBase {
  title: string;
  subtitle: string;
  image: NhMediaImage | null;
  price?: string;
  audioHref?: string;
  buyHref: string;
}
