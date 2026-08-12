/**
 * Eventos — fetchers de la página de eventos (detalle + listado/calendario).
 *
 * El tipo liviano `NhEvento` (fetchers.ts) sigue intacto para las mini-cards;
 * aquí viven los modelos ricos de la página de detalle y del listado.
 */

import type { JsonApiResource, JsonApiRelationship, JsonApiResourceIdentifier } from './client';
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds, stripHtml } from './helpers';
import { parseMediaImage, resolveFileUrl } from './parsers';
import type { NhMediaImage, NhEntityMeta } from './parsers';
import { NODEHIVE_CONFIG } from './config';

/* ─── Tipos ───────────────────────────────────────────────────── */

export interface NhEventosHero extends NhEntityMeta {
  title: string;
  subtitle: string;
  photo: NhMediaImage | null;
}

export interface NhEventoProgramaDia {
  titulo: string;
  fecha: string;
  horario: string;
  descripcion: string;
}

export interface NhEventoLineupArtista {
  artista: { name: string; href: string; imagen: NhMediaImage | null };
  rol: string;
}

export interface NhEventoTipoEntrada {
  nombre: string;
  sku: string;
  precio: number | null;
  descripcion: string;
  capacidad: number | null;
  disponibles: number | null;
  destacado: boolean;
}

export interface NhEventoDetalle extends NhEntityMeta {
  title: string;
  categoria: string;
  descripcion: string;
  heroImage: NhMediaImage | null;
  fechaInicio: string;
  fechaFin: string;
  hora: string;
  lugar: string;
  direccionCompleta: string;
  esInternacional: boolean;
  programa: NhEventoProgramaDia[];
  lineup: NhEventoLineupArtista[];
  tiposEntrada: NhEventoTipoEntrada[];
  href: string;
}

export interface NhEventoListItem extends NhEntityMeta {
  title: string;
  href: string;
  thumbnail: NhMediaImage | null;
  fechaInicio: string;
  fechaFin: string;
  lugar: string;
  categoria: string;
  esInternacional: boolean;
  descripcionCorta: string;
  precioDesde: number | null;
  agotado: boolean;
  artistas: string[];
}

/* ─── Helpers de parsing ──────────────────────────────────────── */

const ROL_LINEUP: Record<string, string> = {
  cabeza_de_cartel: 'Cabeza de cartel',
  invitado_especial: 'Invitado Especial',
  orquesta: 'Orquesta',
  por_confirmar: 'Por confirmar',
};

const EVENTO_INCLUDES =
  'field_imagen_hero,field_imagen_hero.field_media_image,field_categoria,field_programa,field_lineup,field_lineup.field_artista,field_lineup.field_artista.field_imagen,field_lineup.field_artista.field_imagen.field_media_image,field_tipos_entrada';

function parseFechaRange(value: unknown): { inicio: string; fin: string } {
  if (typeof value === 'string') return { inicio: value, fin: value };
  if (value && typeof value === 'object') {
    const obj = value as { value?: unknown; end_value?: unknown };
    const inicio = typeof obj.value === 'string' ? obj.value : '';
    const fin = typeof obj.end_value === 'string' ? obj.end_value : inicio;
    return { inicio, fin };
  }
  return { inicio: '', fin: '' };
}

function parseNumero(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esEventoPasado(fechaFin: string, hoy: string): boolean {
  if (!ISO_FECHA.test(fechaFin) || !ISO_FECHA.test(hoy)) return false;
  return fechaFin < hoy;
}

function parseImagen(
  rel: JsonApiRelationship | undefined,
  included: JsonApiResource[],
): NhMediaImage | null {
  const ids = resolveRelIds(rel);
  if (ids.length === 0) return null;
  const media = findIncluded(included, 'media--image', ids[0].id);
  if (!media) return null;
  const img = parseMediaImage(media, included);
  if (img?.url) img.url = resolveFileUrl(img.url);
  return img;
}

function parseArtistaRef(
  resource: JsonApiResource,
): { name: string; href: string; nid: number } {
  const a = resource.attributes as Record<string, unknown>;
  const name = (a.title as string) ?? '';
  const nid = (a.drupal_internal__nid as number) ?? 0;
  const path = (a.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/artista/${nid}`;
  return { name, href, nid };
}

function parseLineup(resource: JsonApiResource, included: JsonApiResource[]): NhEventoLineupArtista[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_lineup)
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--evento_artista_lineup', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const artistaRel = p.relationships?.field_artista?.data as JsonApiResourceIdentifier | undefined;
      if (!artistaRel) return null;
      const artistaRes = findIncluded(included, 'node--artista', artistaRel.id);
      if (!artistaRes) return null;
      const artistaRef = parseArtistaRef(artistaRes);
      const rolKey = (pa.field_rol as string) ?? '';
      return {
        artista: {
          name: artistaRef.name,
          href: artistaRef.href,
          imagen: parseImagen(artistaRes.relationships?.field_imagen, included),
        },
        rol: ROL_LINEUP[rolKey] ?? rolKey,
      };
    })
    .filter((e): e is NhEventoLineupArtista => e !== null);
}

function parsePrograma(resource: JsonApiResource, included: JsonApiResource[]): NhEventoProgramaDia[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_programa)
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--evento_dia_programa', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const fecha = (pa.field_fecha_dia as string) ?? '';
      if (!fecha) return null;
      return {
        titulo: (pa.field_titulo_dia as string) ?? '',
        fecha,
        horario: (pa.field_horario_texto as string) ?? '',
        descripcion: (pa.field_descripcion_dia as { value?: string } | undefined)?.value ?? '',
      };
    })
    .filter((d): d is NhEventoProgramaDia => d !== null);
}

function parseTiposEntrada(
  resource: JsonApiResource,
  included: JsonApiResource[],
): NhEventoTipoEntrada[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_tipos_entrada)
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--evento_tipo_entrada', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const nombre = (pa.field_nombre_entrada as string) ?? '';
      if (!nombre) return null;
      return {
        nombre,
        sku: (pa.field_sku as string) ?? '',
        precio: parseNumero(pa.field_precio),
        descripcion: (pa.field_descripcion_entrada as string) ?? '',
        capacidad: parseNumero(pa.field_capacidad),
        disponibles: parseNumero(pa.field_disponibles),
        destacado: Boolean(pa.field_destacado),
      };
    })
    .filter((t): t is NhEventoTipoEntrada => t !== null);
}

export function parseEventoDetalle(
  resource: JsonApiResource<Record<string, unknown>>,
  included: JsonApiResource[],
): NhEventoDetalle {
  const a = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  const { inicio, fin } = parseFechaRange(a.field_fecha);
  const body = a.body as { value?: string; summary?: string } | undefined;
  const nid = (a.drupal_internal__nid as number) ?? 0;
  const path = (a.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/evento/${nid}`;

  let categoria = '';
  const categoriaRel = rels?.field_categoria?.data as JsonApiResourceIdentifier | undefined;
  if (categoriaRel) {
    const term = findIncluded(included, 'taxonomy_term--tipo_de_evento', categoriaRel.id);
    categoria = ((term?.attributes as Record<string, unknown> | undefined)?.name as string) ?? '';
  }

  return {
    id: resource.id,
    internalId: nid,
    parentId: '',
    bundle: 'evento',
    title: (a.title as string) ?? '',
    categoria,
    descripcion: body?.value ?? '',
    heroImage: parseImagen(rels?.field_imagen_hero, included),
    fechaInicio: inicio,
    fechaFin: fin || inicio,
    hora: (a.field_hora as string) ?? '',
    lugar: (a.field_lugar as string) ?? '',
    direccionCompleta: (a.field_direccion_completa as { value?: string } | undefined)?.value ?? '',
    esInternacional: Boolean(a.field_es_internacional),
    programa: parsePrograma(resource, included),
    lineup: parseLineup(resource, included),
    tiposEntrada: parseTiposEntrada(resource, included),
    href,
  };
}

function parseEventoListItem(
  resource: JsonApiResource<Record<string, unknown>>,
  included: JsonApiResource[],
): NhEventoListItem {
  const a = resource.attributes as Record<string, unknown>;
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  const { inicio, fin } = parseFechaRange(a.field_fecha);
  const body = a.body as { value?: string; summary?: string } | undefined;
  const nid = (a.drupal_internal__nid as number) ?? 0;
  const path = (a.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/evento/${nid}`;

  const tipos = parseTiposEntrada(resource, included);
  const precios = tipos.map((t) => t.precio).filter((p): p is number => p !== null);
  const agotado = tipos.length > 0 && tipos.every((t) => t.disponibles === 0);

  let categoria = '';
  const categoriaRel = rels?.field_categoria?.data as JsonApiResourceIdentifier | undefined;
  if (categoriaRel) {
    const term = findIncluded(included, 'taxonomy_term--tipo_de_evento', categoriaRel.id);
    categoria = ((term?.attributes as Record<string, unknown> | undefined)?.name as string) ?? '';
  }

  const artistas: string[] = [];
  for (const ref of resolveRelIds(rels?.field_lineup)) {
    const p = findIncluded(included, 'paragraph--evento_artista_lineup', ref.id);
    const artistaRel = p?.relationships?.field_artista?.data as JsonApiResourceIdentifier | undefined;
    if (!artistaRel) continue;
    const artistaRes = findIncluded(included, 'node--artista', artistaRel.id);
    const name = ((artistaRes?.attributes as Record<string, unknown> | undefined)?.title as string) ?? '';
    if (name) artistas.push(name);
  }

  const summary = body?.summary ?? stripHtml(body?.value ?? '').trim();

  return {
    id: resource.id,
    internalId: nid,
    parentId: '',
    bundle: 'evento',
    title: (a.title as string) ?? '',
    href,
    thumbnail: parseImagen(rels?.field_imagen_hero, included),
    fechaInicio: inicio,
    fechaFin: fin || inicio,
    lugar: (a.field_lugar as string) ?? '',
    categoria,
    esInternacional: Boolean(a.field_es_internacional),
    descripcionCorta: summary,
    precioDesde: precios.length ? Math.min(...precios) : null,
    agotado,
    artistas,
  };
}

/* ─── Fetchers ────────────────────────────────────────────────── */

const LISTADO_LIMIT = 100;

export async function fetchEventosListado(lang = 'es'): Promise<NhEventoListItem[]> {
  try {
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate(),
    ).padStart(2, '0')}`;
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/evento?filter[field_fecha.end_value][value]=${hoyStr}&filter[field_fecha.end_value][operator]=%3E%3D&sort=field_fecha.value&page[limit]=${LISTADO_LIMIT}&include=field_imagen_hero,field_imagen_hero.field_media_image,field_categoria,field_tipos_entrada,field_lineup,field_lineup.field_artista`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return data.map((r) => parseEventoListItem(r, res.included ?? []));
  } catch (e) {
    console.warn('[NodeHive] fetchEventosListado failed:', e);
    return [];
  }
}

export async function fetchEventoByPath(
  path: string,
  lang = 'es',
): Promise<NhEventoDetalle | null> {
  try {
    const cleanPath = path.replace(/^\/?(es\/|en\/)?/, '/').replace(/\/$/, '');
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/evento?filter[path.alias][value]=${encodeURIComponent(cleanPath)}&include=${EVENTO_INCLUDES}`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    return parseEventoDetalle(data[0], res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchEventoByPath failed:', e);
    return null;
  }
}

export async function fetchEventoByNid(
  nid: number,
  lang = 'es',
): Promise<NhEventoDetalle | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/evento?filter[drupal_internal__nid]=${nid}&include=${EVENTO_INCLUDES}`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    return parseEventoDetalle(data[0], res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchEventoByNid failed:', e);
    return null;
  }
}

const EVENTOS_HERO_BUNDLE = '_component_eventos_hero';

export async function fetchEventosHero(lang = 'es'): Promise<NhEventosHero | null> {
  try {
    const PAGE_UUID = NODEHIVE_CONFIG.pages.eventos;
    if (!PAGE_UUID) return null;

    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/astro_page/${PAGE_UUID}?include=field_components,field_components.field_photo,field_components.field_photo.field_media_image`,
      lang,
    );

    const data = res.data as JsonApiResource;
    const included = res.included ?? [];
    const componentRefs = resolveRelIds(data.relationships?.field_components);
    const heroRef = componentRefs.find((r) => r.type === `paragraph--${EVENTOS_HERO_BUNDLE}`);
    if (!heroRef) return null;

    const heroComp = findIncluded(included, `paragraph--${EVENTOS_HERO_BUNDLE}`, heroRef.id);
    if (!heroComp) return null;

    const attrs = heroComp.attributes as Record<string, unknown>;
    const photoRefs = resolveRelIds(heroComp.relationships?.field_photo);
    let photo: NhMediaImage | null = null;
    if (photoRefs.length) {
      const mediaRes = findIncluded(included, 'media--image', photoRefs[0].id);
      if (mediaRes) {
        photo = parseMediaImage(mediaRes, included);
        if (photo?.url) photo.url = resolveFileUrl(photo.url);
      }
    }

    return {
      id: heroComp.id,
      internalId: (attrs.drupal_internal__id as number) ?? 0,
      parentId: (attrs.parent_id as string) ?? '',
      bundle: EVENTOS_HERO_BUNDLE,
      title: (attrs.field_title as string) ?? (attrs.field_titulo as string) ?? '',
      subtitle: (attrs.field_subtitle as string) ?? '',
      photo,
    };
  } catch (e) {
    console.warn('[NodeHive] Failed to fetch eventos hero:', e);
    return null;
  }
}
