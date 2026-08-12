import type {
  NhBase,
  NhMediaImage,
  NhMediaFile,
  NhMediaVideo,
  NhRemoteVideo,
  NhEntityMeta,
} from './parsers';

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
  endDate?: string;
  time: string;
  href: string;
}

export interface NhEventoLink {
  id: string;
  internalId: number;
  parentId: string;
  bundle: string;
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
  /** App externa no embebible (p. ej. iMusic) → abrir en otra pestaña */
  externalApp?: { title: string; url: string; platform: string } | null;
  format?: string;
  price?: string;
  internalId?: number;
  parentId?: string;
  bundle?: string;
  nid?: number;
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
  video?: NhMediaVideo | null;
  remoteVideo?: NhRemoteVideo | null;
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
}

export type NhMusicPlatform = 'spotify' | 'apple_music' | 'other';

export interface NhExternalApp {
  title: string;
  url: string;
  platform: NhMusicPlatform;
  embedUrl: string | null;
}

export interface NhTrack {
  title: string;
  durationSeconds: number | null;
  audioUrl: string | null;
  previewUrl: string | null;
  previewPlatform: NhMusicPlatform | null;
  previewEmbedUrl: string | null;
}

export interface NhAlbumDiscografia extends NhBase {
  nid: number;
  title: string;
  year: number | null;
  decada?: string;
  albumNumber: number | null;
  body: string;
  cover: NhMediaImage | null;
  sello?: { name: string; tid: number; slug: string };
  lanzamiento?: { name: string; tid: number; slug: string };
  artista?: { name: string; slug: string; nid: number; href: string };
  interprete?: { name: string; slug: string; nid: number; href: string };
  agencia?: { name: string; slug: string };
  tracks: NhTrack[];
  externalApps: NhExternalApp[];
  href: string;
  artistName?: string;
}

export interface NhVideoArtistaRef {
  name: string;
  href: string;
  nid: number;
}

export interface NhCatalogoVideo {
  id: string;
  url: string;
  youtubeId: string | null;
  title: string;
  thumbnail: string | null;
  body?: string;
  artistas: NhVideoArtistaRef[];
  tipo?: { name: string; slug: string };
}

export interface NhVideoDetail {
  youtubeId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string | null;
  viewCount: number | null;
  thumbnail: string | null;
}

export interface NhVideoDestacado {
  url: string;
  youtubeId: string | null;
  title: string;
  thumbnail: string | null;
  detail: NhVideoDetail | null;
}

export interface CatalogoVideosParams {
  artista?: string;
  tipo?: string;
  page?: number;
  limit?: number;
}

export interface CatalogoVideosResult {
  videos: NhCatalogoVideo[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
  availableArtistas: { name: string; slug: string; nid: number }[];
  availableTipos: { name: string; slug: string }[];
}

/* ─── About / Quiénes Somos ────────────────────────────────────── */

export interface NhSedeAddress {
  address_line1: string;
  locality: string;
  administrative_area: string;
  country_code: string;
}

export interface NhSedePhone {
  phone_number: string;
  country_code: string;
  local_number: string;
}

export interface NhSede extends NhBase {
  title: string;
  direccion: NhSedeAddress | null;
  location: { lat: number; lon: number } | null;
  telefono: NhSedePhone[];
  correo: string;
  horario: { value: string; end_value: string } | null;
  imagen: NhMediaImage | null;
  tipo: { name: string; tid: number } | null;
}

export interface NhMisionVision extends NhEntityMeta {
  title: string;
  subtitle: string;
  mision: { title: string; body: string } | null;
  vision: { title: string; body: string } | null;
}

export interface NhAboutFormHeader extends NhEntityMeta {
  title: string;
  subtitle: string;
}

/* ─── Contacto ──────────────────────────────────────────────────── */

export interface NhContactoPage extends NhEntityMeta {
  title: string;
  subtitle: string;
  sede: NhSede | null;
}

export interface NhTipoConsultaOption {
  value: string;
  label_es: string;
  label_en: string;
}
