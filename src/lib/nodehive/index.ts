// Internal (no re-exported by name, but available for type use)
export type { JsonApiResource, JsonApiResponse } from './client';

// Parsers — primitives
export type { NhLink, NhMediaImage, NhMediaFile, NhMediaVideo, NhRemoteVideo, NhButton, NhEntityMeta, NhBase } from './parsers';

// Fragments
export type { NhRed, NhContacto, NhHeaderFragment, NhFooterFragment } from './fragments';
export { fetchHeaderFragment, fetchFooterFragment } from './fragments';

// Pages
export type { NhHero, NhEslogan, NhSection, NhHomePage } from './pages';
export { fetchHomePage, fetchLoginPage, fetchCatalogoHero } from './pages';

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
export { resolveFileUrl, normalizeDrupalUri } from './parsers';
export { slugify, stripHtml, estimateReadingTime } from './helpers';

// YouTube
export {
  extractYouTubeId,
  fetchOEmbed,
  resolveVideoLink,
  fetchVideoDetail,
  clearCache as clearYoutubeCache,
} from './youtube';
export type { OEmbedResult as YoutubeOEmbedResult, ResolvedVideo, NhVideoDetail } from './youtube';

// Spotify
export {
  extractSpotifyId,
  fetchOEmbed as fetchSpotifyOEmbed,
  resolveSpotifyLink,
  clearCache as clearSpotifyCache,
} from './spotify';
export type { OEmbedResult as SpotifyOEmbedResult, ResolvedAlbum } from './spotify';

// Artistas
export type { NhArtistaListItem, NhArtistaDetail, NhRedSocial, NhAlbumDiscografia, NhArtistaVideo } from './entities';
export { fetchArtistas, fetchArtistaByPath, fetchArtistaByNid, fetchAlbumsByArtist } from './artistas';

// Música (catálogo)
export type { CatalogoMusicaParams, CatalogoMusicaResult } from './musica';
export { fetchAlbumesCatalogo, fetchAlbumByPath, fetchAlbumByNid, parseAlbumResource } from './musica';

// Videos (catálogo)
export type {
  NhCatalogoVideo,
  NhVideoDestacado,
  CatalogoVideosParams,
  CatalogoVideosResult,
} from './entities';
export { fetchAllArtistVideos, fetchVideosCatalogo, fetchVideoDestacado } from './videos';

// Search
export type { NhSearchResult, NhSearchResponse } from './search';
export { searchContent, searchAlbums, searchArtistas, searchActualidad, searchVideos, clearSearchCache } from './search';

// About
export type { NhAboutHero } from './about';
export type { NhSede, NhSedeAddress, NhSedePhone, NhMisionVision, NhAboutFormHeader } from './entities';
export { fetchAboutHero, fetchAboutMisionVision, fetchAboutFormHeader } from './about';
export { fetchSedes } from './sedes';
