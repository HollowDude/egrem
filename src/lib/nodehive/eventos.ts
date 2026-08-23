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

export interface NhEventoLocal {
  nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  href: string;
}

export interface NhEventoProgramaDia {
  id: string;
  titulo: string;
  fecha: string;
  horario: string;
  descripcion: string;
  zonaId: string | null;
}

export interface NhEventoLineupArtista {
  artista: { name: string; href: string; imagen: NhMediaImage | null };
  rol: string;
}

export interface NhEventoDiaResuelto {
  id: string;
  titulo: string;
  fecha: string;
}

export interface NhEventoTipoEntrada {
  nombre: string;
  sku: string;
  precio: number | null;
  descripcion: string;
  capacidad: number | null;
  disponibles: number | null;
  destacado: boolean;
  diasIds: string[];
  /** Días referenciados resueltos a { id, titulo, fecha } — evita cruzar contra programa en cada consumidor. */
  diasResueltos: NhEventoDiaResuelto[];
  zonaIds: string[];
}

export interface NhEventoDetalle extends NhEntityMeta {
  title: string;
  categoria: string;
  descripcion: string;
  heroImage: NhMediaImage | null;
  fechaInicio: string;
  fechaFin: string;
  hora: string;
  local: NhEventoLocal | null;
  lugarTexto: string;
  esInternacional: boolean;
  programa: NhEventoProgramaDia[];
  lineup: NhEventoLineupArtista[];
  tiposEntrada: NhEventoTipoEntrada[];
  eventosRelacionados: NhEventoListItem[];
  href: string;
}

export interface NhEventoListItem extends NhEntityMeta {
  title: string;
  href: string;
  thumbnail: NhMediaImage | null;
  fechaInicio: string;
  fechaFin: string;
  lugarTexto: string;
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

// field_programa referencia node--dia_programa (un nodo, NO un paragraph).
// field_dias_entrada (en el tipo de entrada) también referencia node--dia_programa.
// field_zona vive en node--dia_programa → node--zona. Se incluye en ambas ramas
// (field_programa.field_zona y field_tipos_entrada.field_dias_entrada.field_zona)
// porque un día referenciado por una entrada puede no estar en field_programa.
const EVENTO_INCLUDES =
  'field_imagen_hero,field_imagen_hero.field_media_image,field_categoria,field_programa,field_programa.field_zona,field_lineup,field_lineup.field_artista,field_lineup.field_artista.field_imagen,field_lineup.field_artista.field_imagen.field_media_image,field_tipos_entrada,field_tipos_entrada.field_dias_entrada,field_tipos_entrada.field_dias_entrada.field_zona,field_eventos_relacionados,field_eventos_relacionados.field_imagen_hero,field_eventos_relacionados.field_imagen_hero.field_media_image,field_eventos_relacionados.field_categoria,field_eventos_relacionados.field_venue_bat,field_venue_bat';

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

function parseArtistaRef(resource: JsonApiResource): { name: string; href: string; nid: number } {
  const a = resource.attributes as Record<string, unknown>;
  const name = (a.title as string) ?? '';
  const nid = (a.drupal_internal__nid as number) ?? 0;
  const path = (a.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/artista/${nid}`;
  return { name, href, nid };
}

function parseLineup(
  resource: JsonApiResource,
  included: JsonApiResource[],
): NhEventoLineupArtista[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_lineup)
    .map((ref) => {
      const p = findIncluded(included, 'paragraph--evento_artista_lineup', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const artistaRel = p.relationships?.field_artista?.data as
        | JsonApiResourceIdentifier
        | undefined;
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

function parsePrograma(
  resource: JsonApiResource,
  included: JsonApiResource[],
): NhEventoProgramaDia[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_programa)
    .map((ref): NhEventoProgramaDia | null => {
      const p = findIncluded(included, 'node--dia_programa', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const fecha = (pa.field_fecha_dia as string) ?? '';
      if (!fecha) return null;
      const zonaIds = resolveRelIds(p.relationships?.field_zona).map((z) => z.id);
      return {
        id: p.id,
        titulo: (pa.field_titulo_dia as string) ?? '',
        fecha,
        horario: (pa.field_horario_texto as string) ?? '',
        descripcion: (pa.field_descripcion_dia as { value?: string } | undefined)?.value ?? '',
        zonaId: zonaIds[0] ?? null,
      };
    })
    .filter((d): d is NhEventoProgramaDia => d !== null);
}

function parseLocal(
  rel: JsonApiRelationship | undefined,
  included: JsonApiResource[],
): NhEventoLocal | null {
  const ids = resolveRelIds(rel);
  if (ids.length === 0 || ids[0].id === 'missing') return null;
  const local = findIncluded(included, 'node--local', ids[0].id);
  if (!local) return null;
  const a = local.attributes as Record<string, unknown>;

  const dir = a.field_direccion as Record<string, unknown> | undefined;
  const direccion = dir
    ? [dir.address_line1, dir.locality, dir.administrative_area].filter(Boolean).join(', ')
    : '';

  const loc = a.field_location as Record<string, unknown> | undefined;
  const lat = loc && typeof loc.lat === 'number' ? loc.lat : null;
  const lng = loc && typeof loc.lon === 'number' ? loc.lon : null;

  const nid = (a.drupal_internal__nid as number) ?? 0;
  const path = (a.path as { alias?: string | null } | undefined)?.alias;
  const href = path && path.startsWith('/') ? path : `/local/${nid}`;

  return { nombre: (a.title as string) ?? '', direccion, lat, lng, href };
}

function parseTiposEntrada(
  resource: JsonApiResource,
  included: JsonApiResource[],
): NhEventoTipoEntrada[] {
  const rels = resource.relationships as Record<string, JsonApiRelationship> | undefined;
  return resolveRelIds(rels?.field_tipos_entrada)
    .map((ref): NhEventoTipoEntrada | null => {
      const p = findIncluded(included, 'paragraph--evento_tipo_entrada', ref.id);
      if (!p) return null;
      const pa = p.attributes as Record<string, unknown>;
      const nombre = (pa.field_nombre_entrada as string) ?? '';
      if (!nombre) return null;

      // La zona NO se lee de field_zona_entrada (no existe en el paragraph; vive
      // en la variación de Commerce). Se deriva de los días referenciados:
      // zonaIds = unión de zonaId de cada field_dias_entrada.
      const diasIds = resolveRelIds(p.relationships?.field_dias_entrada).map((d) => d.id);
      const diasResueltos: NhEventoDiaResuelto[] = [];
      const zonaIds = diasIds
        .map((diaId) => {
          const dia = findIncluded(included, 'node--dia_programa', diaId);
          if (!dia) return null;
          const da = dia.attributes as Record<string, unknown>;
          diasResueltos.push({
            id: dia.id,
            titulo: (da.field_titulo_dia as string) ?? '',
            fecha: (da.field_fecha_dia as string) ?? '',
          });
          const zIds = resolveRelIds(dia.relationships?.field_zona).map((z) => z.id);
          return zIds[0] ?? null;
        })
        .filter((z): z is string => z !== null);

      // TODO: retirar fallback cuando exista Opción B (field_entradas_disponibles) en Drupal.
      let capacidad: number | null = null;
      let disponibles: number | null = null;
      const rawDisp = (resource.attributes as Record<string, unknown>).field_entradas_disponibles;
      if (Array.isArray(rawDisp)) {
        const sku = (pa.field_sku as string) ?? '';
        const match = rawDisp.find(
          (e) => typeof e === 'object' && e !== null && (e as Record<string, unknown>).sku === sku,
        ) as Record<string, unknown> | undefined;
        if (match) {
          capacidad = parseNumero(match.capacidad);
          disponibles = parseNumero(match.disponibles);
        }
      }

      return {
        nombre,
        sku: (pa.field_sku as string) ?? '',
        precio: parseNumero(pa.field_precio),
        descripcion: (pa.field_descripcion_entrada as string) ?? '',
        capacidad,
        disponibles,
        destacado: Boolean(pa.field_destacado),
        diasIds,
        diasResueltos,
        zonaIds,
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

  const local = parseLocal(rels?.field_venue_bat, included);

  const eventosRelacionados: NhEventoListItem[] = resolveRelIds(rels?.field_eventos_relacionados)
    .map((ref) => {
      const node = findIncluded(included, 'node--evento', ref.id);
      if (!node) return null;
      return parseEventoListItem(node, included);
    })
    .filter((e): e is NhEventoListItem => e !== null);

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
    local,
    lugarTexto: local?.nombre || '',
    esInternacional: Boolean(a.field_es_internacional),
    programa: parsePrograma(resource, included),
    lineup: parseLineup(resource, included),
    tiposEntrada: parseTiposEntrada(resource, included),
    eventosRelacionados,
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
  // Limitación conocida hasta la Fase 2 (Commerce): con `disponibles` en null,
  // "agotado" nunca se activa. Es esperado y correcto por ahora.
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
    const artistaRel = p?.relationships?.field_artista?.data as
      | JsonApiResourceIdentifier
      | undefined;
    if (!artistaRel) continue;
    const artistaRes = findIncluded(included, 'node--artista', artistaRel.id);
    const name =
      ((artistaRes?.attributes as Record<string, unknown> | undefined)?.title as string) ?? '';
    if (name) artistas.push(name);
  }

  const summary = body?.summary ?? stripHtml(body?.value ?? '').trim();
  const local = parseLocal(rels?.field_venue_bat, included);

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
    lugarTexto: local?.nombre || '',
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
      `node/evento?filter[field_fecha.end_value][value]=${hoyStr}&filter[field_fecha.end_value][operator]=%3E%3D&sort=field_fecha.value&page[limit]=${LISTADO_LIMIT}&include=field_imagen_hero,field_imagen_hero.field_media_image,field_categoria,field_tipos_entrada,field_tipos_entrada.field_dias_entrada,field_lineup,field_lineup.field_artista,field_venue_bat`,
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

export async function fetchEventoByNid(nid: number, lang = 'es'): Promise<NhEventoDetalle | null> {
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

export async function fetchEventoById(id: string, lang = 'es'): Promise<NhEventoDetalle | null> {
  try {
    const res = await jsonApiFetch<Record<string, unknown>>(
      `node/evento/${id}?include=${EVENTO_INCLUDES}`,
      lang,
    );
    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    if (data.length === 0) return null;
    return parseEventoDetalle(data[0], res.included ?? []);
  } catch (e) {
    console.warn('[NodeHive] fetchEventoById failed:', e);
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
