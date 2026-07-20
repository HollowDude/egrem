// Internal (no re-exported by name, but available for type use)
export type { JsonApiResource, JsonApiResponse } from './client';

// Parsers — primitives
export type { NhLink, NhMediaImage, NhMediaFile, NhButton, NhEntityMeta, NhBase } from './parsers';

// Fragments
export type { NhRed, NhContacto, NhHeaderFragment, NhFooterFragment } from './fragments';
export { fetchHeaderFragment, fetchFooterFragment } from './fragments';

// Pages
export type { NhHero, NhEslogan, NhSection, NhHomePage } from './pages';
export { fetchHomePage, fetchLoginPage } from './pages';

// Content fetchers
export type {
  NhAlbum,
  NhEvento,
  NhVideo,
  NhProduccion,
  NhVideoLink,
  NhAlbumLink,
  NhLoginPage,
  NhLoginRight,
  NhActualidadItem,
  NhActualidadBundle,
  NhActualidadTag,
  NhActualidadHero,
  NhArtist,
} from './entities';
export { fetchLanzamientos, fetchEventos, fetchProducciones, fetchVideos } from './fetchers';
export type { NhPatrimonioSection } from './actualidad';
export {
  parseActualidadNode,
  resolveActualidadRefs,
  fetchActualidadItems,
  fetchActualidadItemByPath,
  fetchActualidadItemPathInLang,
  resolveInlineImages,
  fetchPatrimonioSection,
  fetchActualidadHero,
} from './actualidad';
export { getRelatedItems } from './related';

// Utilities
export { resolveFileUrl } from './parsers';
export { slugify, stripHtml, estimateReadingTime } from './helpers';

// YouTube
export {
  extractYouTubeId,
  fetchOEmbed,
  resolveVideoLink,
  clearCache as clearYoutubeCache,
} from './youtube';
export type { OEmbedResult as YoutubeOEmbedResult, ResolvedVideo } from './youtube';

// Spotify
export {
  extractSpotifyId,
  fetchOEmbed as fetchSpotifyOEmbed,
  resolveSpotifyLink,
  clearCache as clearSpotifyCache,
} from './spotify';
export type { OEmbedResult as SpotifyOEmbedResult, ResolvedAlbum } from './spotify';
