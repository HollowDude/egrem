import type { NhBase, NhMediaImage, NhEntityMeta } from '@/lib/nodehive';

/**
 * Authenticated user object stored in session or context.
 * uid and name are always present; roles is intentionally empty for security
 * (roles should be fetched server-side when needed, not from client cookies).
 */
export interface DrupalUser {
  uid: string;
  name: string;
  mail?: string;
  roles: string[];
}

/**
 * Extended user data returned by Drupal login endpoint.
 * Includes session info and full user details. This is used
 * internally only during login flow, not stored in client cookies.
 */
export interface DrupalUserSession extends DrupalUser {
  session_name: string;
  session_id: string;
}

/**
 * Session user stored in the encrypted JWT cookie.
 * Includes tokens needed for authenticated Drupal API calls.
 */
export interface SessionUser {
  uid: string;
  name: string;
  mail: string;
  roles: string[];
  csrfToken: string;
  logoutToken: string;
  accessToken: string;
}

/**
 * Response structure from Drupal /user/login endpoint.
 */
export interface DrupalLoginResponse {
  current_user: {
    uid: string;
    name: string;
    mail?: string;
    roles?: string[];
  };
  csrf_token: string;
  logout_token: string;
  access_token?: string;
}

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
