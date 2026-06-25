/**
 * NodeHive JSON:API client for Drupal.
 *
 * All fetch functions hit the Drupal JSON:API and return typed data.
 * The API key is sent via X-Auth-Token header.
 *
 * Environment variables:
 *   NODEHIVE_BASE_URL  — e.g. http://127.0.0.1:61522
 *   NODEHIVE_API_KEY   — API consumer token
 */

// ────────────────────────────────────────────────────────────
// Types — JSON:API envelope
// ────────────────────────────────────────────────────────────

interface JsonApiResource<A = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: A;
  relationships?: Record<string, JsonApiRelationship>;
}

interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
}

interface JsonApiResourceIdentifier {
  type: string;
  id: string;
  meta?: Record<string, unknown>;
}

interface JsonApiResponse<A = Record<string, unknown>> {
  data: JsonApiResource<A> | JsonApiResource<A>[];
  included?: JsonApiResource[];
}

// ────────────────────────────────────────────────────────────
// Types — Domain (what the frontend components consume)
// ────────────────────────────────────────────────────────────

export interface NhButton {
  id: string;
  title: string;
  style: 'primary' | 'secondary';
  link: NhLink | null;
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

/** Metadata needed by NodeHiveEntity wrapper */
export interface NhEntityMeta {
  id: string;
  internalId: number;
  parentId: string;
  bundle: string;
}

/** Hero section */
export interface NhHero extends NhEntityMeta {
  title: string;
  subtitle: string;
  buttons: NhButton[];
  photo: NhMediaImage | null;
}

/** Eslogan / promo banner */
export interface NhEslogan extends NhEntityMeta {
  title: string;
}

/** Generic section with just a title (novedades, lanzamientos, eventos, videos, producciones) */
export interface NhSection extends NhEntityMeta {
  title: string;
  type: string;
}

/** Social network link */
export interface NhRed {
  id: string;
  link: NhLink;
}

/** Footer contact info */
export interface NhContacto {
  id: string;
  direccion: string;
  correo: string;
  telefono: string;
  boton: NhButton | null;
}

/** Header fragment */
export interface NhHeaderFragment {
  id: string;
  title: string;
  logo: NhMediaImage | null;
}

/** Footer fragment */
export interface NhFooterFragment {
  id: string;
  title: string;
  derechos: string;
  logo: NhMediaImage | null;
  tagline: string;
  redes: NhRed[];
  contacto: NhContacto | null;
}

/** Full homepage data */
export interface NhHomePage {
  id: string;
  nodeId: number;
  title: string;
  hero: NhHero | null;
  eslogan: NhEslogan | null;
  sections: NhSection[];
}

// ────────────────────────────────────────────────────────────
// Client
// ────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

function getApiKey(): string {
  const key = import.meta.env.NODEHIVE_API_KEY;
  if (!key) throw new Error('NODEHIVE_API_KEY is not set');
  return key;
}

async function jsonApiFetch<A = Record<string, unknown>>(
  path: string,
  lang = 'es',
): Promise<JsonApiResponse<A>> {
  const url = `${getBaseUrl()}/${lang}/jsonapi/${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.api+json',
      'X-Auth-Token': getApiKey(),
    },
  });
  if (!res.ok) {
    throw new Error(`NodeHive fetch failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

// ────────────────────────────────────────────────────────────
// Helpers — extract included resources
// ────────────────────────────────────────────────────────────

function findIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
  id: string,
): JsonApiResource | undefined {
  return included?.find((r) => r.type === type && r.id === id);
}

function findAllIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
): JsonApiResource[] {
  return included?.filter((r) => r.type === type) ?? [];
}

function resolveRelIds(rel: JsonApiRelationship | undefined): JsonApiResourceIdentifier[] {
  if (!rel?.data) return [];
  return Array.isArray(rel.data) ? rel.data : [rel.data];
}

function parseButton(res: JsonApiResource): NhButton {
  const a = res.attributes as Record<string, unknown>;
  const link = a.field_link as { uri: string; title: string } | null;
  return {
    id: res.id,
    title: (a.field_title as string) ?? '',
    style: (a.field_style as 'primary' | 'secondary') ?? 'primary',
    link: link ? { uri: link.uri, title: link.title ?? '' } : null,
  };
}

function parseMediaImage(
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
    url: uri?.url ?? '',
    alt: (mediaRes.attributes as Record<string, unknown>).name as string ?? '',
    filename: (attrs.filename as string) ?? '',
  };
}

// ────────────────────────────────────────────────────────────
// Public fetch functions
// ────────────────────────────────────────────────────────────

/**
 * Fetch the full homepage page node with all paragraph components.
 * UUIDs are hardcoded for now — in production, use a router or slug lookup.
 */
export async function fetchHomePage(lang = 'es'): Promise<NhHomePage> {
  const PAGE_UUID = '1cfdb266-b8d9-4b45-b25a-706873147773';

  const res = await jsonApiFetch(
    `node/page/${PAGE_UUID}?include=field_components,field_components.field_buttons,field_components.field_photo`,
    lang,
  );

  const data = res.data as JsonApiResource;
  const included = res.included;

  // Extract components in order
  const componentRels = resolveRelIds(data.relationships?.field_components);

  let hero: NhHero | null = null;
  let eslogan: NhEslogan | null = null;
  const sections: NhSection[] = [];

  for (const ref of componentRels) {
    const comp = findIncluded(included, ref.type, ref.id);
    if (!comp) continue;
    const attrs = comp.attributes as Record<string, unknown>;
    const compType = ref.type.replace('paragraph--', '');

    const internalId = (attrs.drupal_internal__id as number) ?? 0;
    const parentId = (attrs.parent_id as string) ?? '';

    if (compType === '_component_homepage_hero') {
      // Resolve buttons
      const buttonRefs = resolveRelIds(comp.relationships?.field_buttons);
      const buttons = buttonRefs
        .map((br) => findIncluded(included, 'paragraph--button', br.id))
        .filter(Boolean)
        .map((b) => parseButton(b!));

      // Resolve photo
      const photoRefs = resolveRelIds(comp.relationships?.field_photo);
      let photo: NhMediaImage | null = null;
      if (photoRefs.length) {
        const mediaRes = findIncluded(included, photoRefs[0].type, photoRefs[0].id);
        if (mediaRes) photo = parseMediaImage(mediaRes, included);
      }

      hero = {
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        subtitle: (attrs.field_subtitle as string) ?? '',
        buttons,
        photo,
      };
    } else if (compType === '_component_homepage_eslogan') {
      eslogan = {
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
      };
    } else {
      sections.push({
        id: comp.id,
        internalId,
        parentId,
        bundle: compType,
        title: (attrs.field_title as string) ?? '',
        type: compType,
      });
    }
  }

  const pageAttrs = data.attributes as Record<string, unknown>;

  return {
    id: data.id,
    nodeId: (pageAttrs.drupal_internal__nid as number) ?? 0,
    title: pageAttrs.title as string,
    hero,
    eslogan,
    sections,
  };
}

/**
 * Fetch the header fragment (logo).
 */
export async function fetchHeaderFragment(lang = 'es'): Promise<NhHeaderFragment> {
  const HEADER_UUID = 'd1aa2e61-9d1a-45b7-9433-fcb1d4127190';

  const res = await jsonApiFetch(
    `nodehive_fragment/header/${HEADER_UUID}?include=field_logo,field_logo.field_media_image`,
    lang,
  );

  const data = res.data as JsonApiResource;
  const included = res.included;
  const attrs = data.attributes as Record<string, unknown>;

  let logo: NhMediaImage | null = null;
  const logoRefs = resolveRelIds(data.relationships?.field_logo);
  if (logoRefs.length) {
    const mediaRes = findIncluded(included, 'media--image', logoRefs[0].id);
    if (mediaRes) logo = parseMediaImage(mediaRes, included);
  }

  return {
    id: data.id,
    title: (attrs.title as string) ?? '',
    logo,
  };
}

/**
 * Fetch the footer fragment (logo, tagline, redes, contacto, copyright).
 */
export async function fetchFooterFragment(lang = 'es'): Promise<NhFooterFragment> {
  const FOOTER_UUID = 'b1ba077b-47d7-4968-bbda-56c48d2ecb1e';

  // Need multiple includes — fetch in steps to avoid 400 from Drupal
  // Step 1: base + logo
  const [resBase, resRedes, resContacto] = await Promise.all([
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_logo,field_logo.field_media_image`,
      lang,
    ),
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_redes,field_redes.field_redes`,
      lang,
    ),
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_contacto,field_contacto.field_boton`,
      lang,
    ),
  ]);

  const data = resBase.data as JsonApiResource;
  const attrs = data.attributes as Record<string, unknown>;

  // Logo
  let logo: NhMediaImage | null = null;
  const logoRefs = resolveRelIds(data.relationships?.field_logo);
  if (logoRefs.length) {
    const mediaRes = findIncluded(resBase.included, 'media--image', logoRefs[0].id);
    if (mediaRes) logo = parseMediaImage(mediaRes, resBase.included);
  }

  // Redes (social links)
  const redes: NhRed[] = [];
  const redItems = findAllIncluded(resRedes.included, 'paragraph--red');
  for (const red of redItems) {
    const ra = red.attributes as Record<string, unknown>;
    const link = ra.field_link as { uri: string; title: string } | null;
    if (link) {
      redes.push({ id: red.id, link: { uri: link.uri, title: link.title ?? '' } });
    }
  }

  // Tagline (field_title on the redes paragraph)
  let tagline = '';
  const redesParent = findAllIncluded(resRedes.included, 'paragraph--redes');
  if (redesParent.length) {
    tagline = ((redesParent[0].attributes as Record<string, unknown>).field_title as string) ?? '';
  }

  // Contacto
  let contacto: NhContacto | null = null;
  const contactoItems = findAllIncluded(resContacto.included, 'paragraph--_component_footer_contacto');
  if (contactoItems.length) {
    const ca = contactoItems[0].attributes as Record<string, unknown>;
    const botonItems = findAllIncluded(resContacto.included, 'paragraph--button');
    contacto = {
      id: contactoItems[0].id,
      direccion: (ca.field_direccion as string) ?? '',
      correo: (ca.field_correo_contacto as string) ?? '',
      telefono: (ca.field_telefono as string) ?? '',
      boton: botonItems.length ? parseButton(botonItems[0]) : null,
    };
  }

  return {
    id: data.id,
    title: (attrs.title as string) ?? '',
    derechos: (attrs.field_derechos as string) ?? '',
    logo,
    tagline,
    redes,
    contacto,
  };
}

/**
 * Build the full absolute URL for a Drupal file path.
 * Input:  "/sites/default/files/2026-06/logo.png"
 * Output: "http://127.0.0.1:61522/sites/default/files/2026-06/logo.png"
 */
export function resolveFileUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getBaseUrl()}${path}`;
}
