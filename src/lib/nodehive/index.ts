// Internal (no re-exported by name, but available for type use)
export type { JsonApiResource, JsonApiResponse } from './client';

// Parsers — primitives
export type { NhLink, NhMediaImage, NhButton, NhEntityMeta, NhBase } from './parsers';

// Fragments
export type { NhRed, NhContacto, NhHeaderFragment, NhFooterFragment } from './fragments';
export { fetchHeaderFragment, fetchFooterFragment } from './fragments';

// Pages
export type { NhHero, NhEslogan, NhSection, NhHomePage } from './pages';
export { fetchHomePage, fetchLoginPage } from './pages';

// Content fetchers
export type { NhNoticia, NhAlbum, NhEvento, NhVideo, NhProduccion, NhVideoLink, NhAlbumLink, NhLoginPage, NhLoginRight } from './entities';
export { fetchNoticias, fetchLanzamientos, fetchEventos, fetchProducciones, fetchVideos } from './fetchers';

// Utilities
export { resolveFileUrl } from './parsers';

// YouTube
export { extractYouTubeId, fetchOEmbed, resolveVideoLink, clearCache as clearYoutubeCache } from './youtube';
export type { OEmbedResult as YoutubeOEmbedResult, ResolvedVideo } from './youtube';

// Spotify
export { extractSpotifyId, fetchOEmbed as fetchSpotifyOEmbed, resolveSpotifyLink, clearCache as clearSpotifyCache } from './spotify';
export type { OEmbedResult as SpotifyOEmbedResult, ResolvedAlbum } from './spotify';
