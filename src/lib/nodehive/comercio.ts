/**
 * Fetcher real de catálogo de merchandising desde Drupal Commerce (JSON:API).
 * Contrato confirmado contra el Drupal de dev (5 bundles):
 *  - `commerce_product/{prenda|accesorio|libro|instrumento|disco}`
 *  - Variaciones: `commerce_product_variation--{bundle}` con `price`, `sku`,
 *    `status`, `field_stock_level`, rels de atributos (talla/color/edicion/formato
 *    son taxonomías → se resuelven con `attrName`), `field_imagen`
 *    (media--image → field_media_image → file--file).
 *  - Libro: `field_autor`/`field_editorial`/`field_isbn`/`field_paginas` (planos).
 *  - Instrumento: `field_materiales`/`field_garantia`/`field_accesorios_incluidos`.
 *  - Disco: `attribute_formato` (tax.), `field_artista` (node--artista),
 *    `field_album_relacionado` (node--album → portada + sello discográfico).
 *
 * `path.alias` NO está configurado (sin Pathauto) → usamos el UUID del
 * producto como `slug` (y como id) para resolver la ficha.
 *
 * Produce exactamente el shape `ProductoDetalle` de `@/types/producto`, así
 * ningún componente (selector, selección, carrito) cambia.
 */
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage } from './parsers';
import { parseAlbumCover, parseArtistaRef } from './musica';
import type { JsonApiResource } from './client';
import type { ProductoDetalle, ProductoVariacion, ProductoColorOpcion, TipoArticulo } from '@/types/producto';

// Include POR BUNDLE: incluir `attribute_talla` en accesorio/disco, o
// `field_album_relacionado` en prenda, hace que Drupal responda 400. Por eso
// cada bundle tiene su propio include.
const BUNDLES: TipoArticulo[] = ['prenda', 'accesorio', 'libro', 'instrumento', 'disco'];
const INCLUDES: Record<TipoArticulo, string> = {
  prenda:
    'variations,variations.attribute_talla,variations.attribute_color,variations.field_imagen,variations.field_imagen.field_media_image',
  accesorio:
    'variations,variations.attribute_color,variations.field_imagen,variations.field_imagen.field_media_image',
  libro:
    'variations,variations.attribute_edicion,variations.field_imagen,variations.field_imagen.field_media_image',
  instrumento:
    'variations,variations.field_imagen,variations.field_imagen.field_media_image',
  disco:
    'variations,variations.attribute_formato,variations.field_imagen,variations.field_imagen.field_media_image,' +
    'variations.field_artista,variations.field_album_relacionado,' +
    'variations.field_album_relacionado.field_imagen_portada,' +
    'variations.field_album_relacionado.field_imagen_portada.field_media_image,' +
    'variations.field_album_relacionado.field_sello',
};

const COLOR_HEX: Record<string, string> = {
  negro: '#1b1b1b',
  rojo: '#bc0100',
  azul: '#1f4e9b',
  blanco: '#ffffff',
  verde: '#2e7d32',
  amarillo: '#f4c20d',
  gris: '#808080',
};

function colorHex(nombre: string | null | undefined): string {
  const k = (nombre ?? '').toLowerCase();
  for (const key of Object.keys(COLOR_HEX)) {
    if (k.includes(key)) return COLOR_HEX[key];
  }
  return '#888888';
}

/** Extrae el string de un campo de texto de Drupal (que viene como {value, format, processed}). */
function textField(f: unknown): string | null {
  if (f == null) return null;
  if (typeof f === 'string') return f.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (typeof f === 'object') {
    const o = f as { value?: unknown; processed?: unknown };
    const raw =
      typeof o.value === 'string'
        ? o.value
        : typeof o.processed === 'string'
          ? o.processed
          : null;
    if (raw) return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return null;
}

function attrName(
  resource: JsonApiResource,
  relName: string,
  included?: JsonApiResource[],
): string | null {
  const rel = resource.relationships?.[relName];
  const ids = resolveRelIds(rel);
  if (!ids.length) return null;
  const term = findIncluded(included, ids[0].type, ids[0].id);
  return (term?.attributes?.name as string) ?? null;
}

function parseVariacion(v: JsonApiResource, included?: JsonApiResource[]): ProductoVariacion {
  const a = v.attributes as Record<string, any>;
  const imgRel = v.relationships?.field_imagen;
  const imgIds = resolveRelIds(imgRel);
  const imagenes: string[] = [];
  for (const ref of imgIds) {
    const media = findIncluded(included, ref.type, ref.id);
    const url = media ? parseMediaImage(media, included)?.url ?? null : null;
    if (url) imagenes.push(url);
  }
  const imagenVarianteUrl = imagenes[0] ?? null;
  const stock = a.field_stock_level?.available_stock ?? null;
  const alwaysInStock = a.commerce_stock_always_in_stock === true;
  const disponible = a.status !== false && (alwaysInStock || (stock ?? 0) > 0);
  const talla = attrName(v, 'attribute_talla', included);
  const colorName = attrName(v, 'attribute_color', included);
  const edicion = attrName(v, 'attribute_edicion', included);
  const formato = attrName(v, 'attribute_formato', included);

  // Disco: artista + lanzamiento relacionado (node--album → portada + sello).
  let artista: ProductoVariacion['artista'] = null;
  let lanzamientoRelacionado: ProductoVariacion['lanzamientoRelacionado'] = null;
  const artistRef = parseArtistaRef(v, 'field_artista', included ?? []);
  if (artistRef) artista = { nombre: artistRef.name, href: artistRef.href };
  const albumRel = v.relationships?.field_album_relacionado?.data as
    | { id: string }
    | undefined;
  if (albumRel?.id) {
    const album = findIncluded(included, 'node--album', albumRel.id);
    if (album) {
      const aa = album.attributes as Record<string, any>;
      const cover = parseAlbumCover(album, included);
      const selloRel = album.relationships?.field_sello?.data as { id: string } | undefined;
      let sello: { nombre: string } | null = null;
      if (selloRel?.id) {
        const term = findIncluded(included, 'taxonomy_term--sello_discografico', selloRel.id);
        const name = term?.attributes?.name as string | undefined;
        if (name) sello = { nombre: name };
      }
      const apath = (aa.path as { alias?: string | null } | undefined)?.alias;
      const href = apath && apath.startsWith('/') ? apath : `/album/${aa.drupal_internal__nid}`;
      lanzamientoRelacionado = {
        titulo: (aa.title as string) ?? '',
        href,
        portada: cover?.url ?? null,
        sello,
      };
    }
  }

  return {
    variationId: a.drupal_internal__variation_id,
    uuid: v.id,
    sku: a.sku ?? '',
    talla,
    color: colorName ? ({ nombre: colorName, hex: colorHex(colorName) } as ProductoColorOpcion) : null,
    imagenVarianteUrl,
    precio: a.price ? parseFloat(a.price.number) : null,
    disponible,
    stock,
    imagenes,
    edicion,
    formato,
    editorial: textField(a.field_editorial),
    paginas: a.field_paginas != null ? Number(textField(a.field_paginas)) : null,
    autor: textField(a.field_autor),
    isbn: textField(a.field_isbn),
    garantia: textField(a.field_garantia),
    accesoriosIncluidos: textField(a.field_accesorios_incluidos),
    materiales: textField(a.field_materiales),
    artista,
    lanzamientoRelacionado,
  };
}

function parseProductoResource(p: JsonApiResource, included?: JsonApiResource[]): ProductoDetalle {
  const a = p.attributes as Record<string, any>;
  const tipo: TipoArticulo = p.type.includes('libro')
    ? 'libro'
    : p.type.includes('instrumento')
      ? 'instrumento'
      : p.type.includes('disco')
        ? 'disco'
        : p.type.includes('accesorio')
          ? 'accesorio'
          : 'prenda';
  const variaciones = (resolveRelIds(p.relationships?.variations) || [])
    .map((ref) => findIncluded(included, ref.type, ref.id))
    .filter((v): v is JsonApiResource => !!v)
    .map((v) => parseVariacion(v, included));

  const primera = variaciones[0];
  const imagenPrincipal = primera?.imagenVarianteUrl ?? primera?.imagenes[0] ?? null;

  return {
    id: p.id,
    slug: p.id, // UUID como slug (sin Pathauto en Drupal)
    titulo: a.title ?? 'Producto',
    tipo,
    descripcion:
      typeof a.field_descripcion === 'string'
        ? a.field_descripcion
        : a.field_descripcion && typeof a.field_descripcion === 'object' &&
            typeof (a.field_descripcion as { value?: unknown }).value === 'string'
          ? (a.field_descripcion as { value: string }).value
          : '',
    materiales: primera?.materiales ?? textField(a.field_materiales) ?? '',
    plazoEnvio: textField(a.field_plazo_envio) ?? '',
    imagenPrincipal,
    variaciones,
  };
}

export async function fetchProductosMerchDetalle(lang = 'es'): Promise<ProductoDetalle[]> {
  try {
    const respuestas = await Promise.all(
      BUNDLES.map((b) =>
        jsonApiFetch(`commerce_product/${b}?include=${INCLUDES[b]}&page[limit]=50`, lang),
      ),
    );
    // Cada bundle trae su propio `included`: combinarlos antes de parsear, si
    // no unas variaciones resuelven sus atributos/imágenes contra el included
    // de otro bundle y llegan vacías.
    const includedAll = respuestas.flatMap((r) => r.included ?? []);
    const dataAll = respuestas.flatMap((r) =>
      Array.isArray(r.data) ? (r.data as JsonApiResource[]) : [],
    );
    return dataAll.map((r) => parseProductoResource(r, includedAll));
  } catch (e) {
    console.warn('[NodeHive] fetchProductosMerchDetalle failed:', e);
    return [];
  }
}
