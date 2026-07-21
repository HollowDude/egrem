import type { NhBase, NhMediaImage, NhMediaFile, NhEntityMeta } from './parsers';

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

export type NhActualidadBundle = 'noticia' | 'article' | 'blog' | 'boletin_archivo';

export interface NhActualidadTag {
  slug: string;
  label: string;
}

export interface NhArtist extends NhBase {
  name: string;
  role?: string;
  photo: NhMediaImage | null;
  href: string;
}

export interface NhActualidadItem extends NhBase {
  nid: number;
  title: string;
  bundle: NhActualidadBundle;
  date: string;
  created: string;
  body: string;
  summary: string;
  author: string;
  patrimonio: boolean;
  image: NhMediaImage | null;
  path: string;
  tags: NhActualidadTag[];
  relatedArtists?: NhArtist[];
  relatedEvents?: NhEvento[];
  attachment?: NhMediaFile | null;
}

export interface NhActualidadHero extends NhEntityMeta {
  title: string;
  subtitle: string;
  photo: NhMediaImage | null;
}

export interface NhRedSocial {
  id: string;
  platform: string;
  url: string;
  label: string;
}

export interface NhArtistaListItem extends NhBase {
  nid: number;
  name: string;
  image: NhMediaImage | null;
  agencia?: { name: string; slug: string; tid: number };
  body: string;
  summary: string;
  href: string;
}

export interface NhArtistaVideo {
  id: string;
  url: string;
  youtubeId: string | null;
  title: string;
  thumbnail: string | null;
}

export interface NhArtistaDetail extends NhArtistaListItem {
  redesSociales: NhRedSocial[];
  videos: NhArtistaVideo[];
}

export interface NhAlbumDiscografia extends NhBase {
  nid: number;
  title: string;
  year: number | null;
  albumNumber: number | null;
  body: string;
  cover: NhMediaImage | null;
  sello?: { name: string; tid: number; slug: string };
  tracks: string[];
  externalApps: { title: string; url: string }[];
  href: string;
  artistName?: string;
}
