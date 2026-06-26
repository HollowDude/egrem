import type { NhBase, NhMediaImage } from '@/lib/nodehive';

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

export interface NhAlbum extends NhBase {
  title: string;
  artist: string;
  cover: NhMediaImage | null;
  href: string;
  format?: string;
  price?: string;
}

export interface NhVideo extends NhBase {
  title: string;
  thumbnail: NhMediaImage | null;
  href: string;
}

export interface NhProduccion extends NhBase {
  title: string;
  subtitle: string;
  image: NhMediaImage | null;
  price?: string;
  audioHref?: string;
  buyHref: string;
}
