// Internal (no re-exported by name, but available for type use)
export type { JsonApiResource, JsonApiResponse } from './client';

// Parsers — primitives
export type { NhLink, NhMediaImage, NhButton, NhEntityMeta, NhBase } from './parsers';

// Fragments
export type { NhRed, NhContacto, NhHeaderFragment, NhFooterFragment } from './fragments';
export { fetchHeaderFragment, fetchFooterFragment } from './fragments';

// Pages
export type { NhHero, NhEslogan, NhSection, NhHomePage } from './pages';
export { fetchHomePage } from './pages';

// Utilities
export { resolveFileUrl } from './parsers';
