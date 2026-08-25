/**
 * Fetcher real de catálogo de merchandising desde Drupal Commerce (JSON:API).
 * Contrato confirmado contra el Drupal de dev:
 *  - Colecciones por bundle: `commerce_product/prenda`, `commerce_product/accesorio`
 *    (no hay endpoint agregado; se consultan ambas y se combinan).
 *  - Variaciones: `commerce_product_variation--{bundle}` con `price`, `sku`,
 *    `status`, `field_stock_level`, rels `attribute_talla`, `attribute_color`,
 *    `field_imagen` (media--image → field_media_image → file--file).
 *  - `path.alias` NO está configurado (sin Pathauto) → usamos el UUID del
 *    producto como `slug` (y como id) para resolver la ficha.
 *  - Los atributos de color solo exponen `name` (sin hex en Drupal) → se usa
 *    `colorHex()` como presentacional.
 *
 * Produce exactamente el shape `ProductoDetalle` de `@/types/producto`, así
 * ningún componente (selector, selección, carrito) cambia.
 */
import { jsonApiFetch } from './client';
import { findIncluded, resolveRelIds } from './helpers';
import { parseMediaImage } from './parsers';
import type { JsonApiResource } from './client';
import type { ProductoDetalle, ProductoVariacion, ProductoColorOpcion, TipoArticulo } from '@/types/producto';

const PRODUCTO_INCLUDES =
  'variations,variations.attribute_talla,variations.attribute_color,variations.field_imagen.field_media_image';

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
  let imagen: string | null = null;
  if (imgIds.length) {
    const media = findIncluded(included, imgIds[0].type, imgIds[0].id);
    if (media) imagen = parseMediaImage(media, included)?.url ?? null;
  }
  const stock = a.field_stock_level?.available_stock ?? null;
  const alwaysInStock = a.commerce_stock_always_in_stock === true;
  const disponible = a.status !== false && (alwaysInStock || (stock ?? 0) > 0);
  const talla = attrName(v, 'attribute_talla', included);
  const colorName = attrName(v, 'attribute_color', included);

  return {
    variationId: a.drupal_internal__variation_id,
    uuid: v.id,
    sku: a.sku ?? '',
    talla,
    color: colorName ? ({ nombre: colorName, hex: colorHex(colorName) } as ProductoColorOpcion) : null,
    imagenVarianteUrl: imagen,
    precio: a.price ? parseFloat(a.price.number) : null,
    disponible,
    stock,
    imagenes: imagen ? [imagen] : [],
  };
}

function parseProductoResource(p: JsonApiResource, included?: JsonApiResource[]): ProductoDetalle {
  const a = p.attributes as Record<string, any>;
  const tipo: TipoArticulo = p.type.includes('accesorio') ? 'accesorio' : 'prenda';
  const variaciones = (resolveRelIds(p.relationships?.variations) || [])
    .map((ref) => findIncluded(included, ref.type, ref.id))
    .filter((v): v is JsonApiResource => !!v)
    .map((v) => parseVariacion(v, included));

  const primera = variaciones[0];
  const imagenPrincipal =
    primera?.imagenVarianteUrl ?? primera?.imagenes[0] ?? null;

  return {
    id: p.id,
    slug: p.id, // UUID como slug (sin Pathauto en Drupal)
    titulo: a.title ?? 'Producto',
    tipo,
    descripcion: typeof a.field_descripcion === 'string' ? a.field_descripcion : '',
    materiales: a.field_materiales ?? '',
    plazoEnvio: a.field_plazo_envio ?? '',
    imagenPrincipal,
    variaciones,
  };
}

export async function fetchProductosMerchDetalle(lang = 'es'): Promise<ProductoDetalle[]> {
  try {
    const [prendas, accesorios] = await Promise.all([
      jsonApiFetch(
        `commerce_product/prenda?include=${PRODUCTO_INCLUDES}&page[limit]=50`,
        lang,
      ),
      jsonApiFetch(
        `commerce_product/accesorio?include=${PRODUCTO_INCLUDES}&page[limit]=50`,
        lang,
      ),
    ]);
    const dataP = (Array.isArray(prendas.data) ? prendas.data : []) as JsonApiResource[];
    const dataA = (Array.isArray(accesorios.data) ? accesorios.data : []) as JsonApiResource[];
    return [...dataP, ...dataA].map((r) =>
      parseProductoResource(r, prendas.included ?? accesorios.included),
    );
  } catch (e) {
    console.warn('[NodeHive] fetchProductosMerchDetalle failed:', e);
    return [];
  }
}

export async function fetchProductoDetalle(
  slug: string,
  lang = 'es',
): Promise<ProductoDetalle | null> {
  for (const bundle of ['prenda', 'accesorio']) {
    try {
      const res = await jsonApiFetch(
        `commerce_product/${bundle}/${encodeURIComponent(slug)}?include=${PRODUCTO_INCLUDES}`,
        lang,
      );
      const data = (Array.isArray(res.data) ? res.data : res.data) as JsonApiResource;
      if (data && (data as any).id) return parseProductoResource(data, res.included);
    } catch {
      /* probar el otro bundle */
    }
  }
  return null;
}
