/**
 * Catálogo mock de fichas de producto (merchandising) para la fase de
 * desarrollo sin Drupal. Reutiliza las imágenes `picsum.photos` de
 * `mockProducts.ts` para consistencia visual.
 *
 * Alterna con el fetch real vía `MERCH_API_REAL` (ver `src/types/producto.ts`).
 */
import type { ProductoDetalle, ProductoColorOpcion, ProductoVariacion, TipoArticulo } from '@/types/producto';
import type { TiendaProducto } from '@/types/tienda';
import { productoATiendaProducto } from '@/lib/tienda/productoAdapters';

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

interface PrendaSpec {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  materiales: string;
  plazoEnvio: string;
  precio: number;
  tallas: string[];
  colores: ProductoColorOpcion[];
  seed: string;
}

function buildPrenda(spec: PrendaSpec): ProductoDetalle {
  const imagenes = [img(`${spec.seed}-1`), img(`${spec.seed}-2`), img(`${spec.seed}-3`), img(`${spec.seed}-4`)];
  const variaciones: ProductoVariacion[] = [];
  let vid = 0;
  for (const talla of spec.tallas) {
    for (const color of spec.colores) {
      vid += 1;
      const sku = `${spec.slug}--${talla.toLowerCase()}--${color.nombre.toLowerCase().replace(/\s+/g, '')}`;
      variaciones.push({
        variationId: vid,
        sku,
        talla,
        color,
        imagenVarianteUrl: null,
        precio: spec.precio,
        disponible: true,
        stock: 12,
        imagenes,
      });
    }
  }
  return {
    id: spec.id,
    slug: spec.slug,
    titulo: spec.titulo,
    tipo: 'prenda',
    descripcion: spec.descripcion,
    materiales: spec.materiales,
    plazoEnvio: spec.plazoEnvio,
    imagenPrincipal: imagenes[0],
    variaciones,
  };
}

interface AccesorioSpec {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  materiales: string;
  plazoEnvio: string;
  precio: number;
  colores: { nombre: string; hex: string; seed: string }[];
}

function buildAccesorio(spec: AccesorioSpec): ProductoDetalle {
  const variaciones: ProductoVariacion[] = [];
  let vid = 0;
  for (const color of spec.colores) {
    vid += 1;
    const imagenes = [img(color.seed), img(`${color.seed}-2`)];
    variaciones.push({
      variationId: vid,
      sku: `${spec.slug}--${color.nombre.toLowerCase().replace(/\s+/g, '')}`,
      talla: null,
      color: { nombre: color.nombre, hex: color.hex },
      imagenVarianteUrl: imagenes[0],
      precio: spec.precio,
      disponible: true,
      stock: 20,
      imagenes,
    });
  }
  return {
    id: spec.id,
    slug: spec.slug,
    titulo: spec.titulo,
    tipo: 'accesorio',
    descripcion: spec.descripcion,
    materiales: spec.materiales,
    plazoEnvio: spec.plazoEnvio,
    imagenPrincipal: variaciones[0]?.imagenVarianteUrl ?? null,
    variaciones,
  };
}

const NEGRO: ProductoColorOpcion = { nombre: 'Negro', hex: '#1b1b1b' };
const ROJO: ProductoColorOpcion = { nombre: 'Rojo', hex: '#bc0100' };
const BLANCO: ProductoColorOpcion = { nombre: 'Blanco', hex: '#ffffff' };

export const MOCK_PRODUCTOS_DETALLE: ProductoDetalle[] = [
  buildPrenda({
    id: 'mock-mer-1',
    slug: 'camiseta-egrem-clasica',
    titulo: 'Camiseta EGREM Clásica',
    descripcion:
      'Camiseta de algodón 100% peinado, con el icónico logotipo de EGREM serigrafiado. Corte clásico, costura reforzada y cuello ribeteado para máxima durabilidad y confort. Disponible en varios colores y tallas.',
    materiales: 'Algodón 100%',
    plazoEnvio: 'Envío en 3-5 días',
    precio: 18.5,
    tallas: ['S', 'M', 'L', 'XL', 'XXL'],
    colores: [NEGRO, ROJO, BLANCO],
    seed: 'egrem-merch-1',
  }),
  buildPrenda({
    id: 'mock-mer-6',
    slug: 'sudadera-egrem',
    titulo: 'Sudadera EGREM',
    descripcion:
      'Sudadera de felpa cepillada con estampado frontal del logotipo EGREM. Capucha forrada, bolsillo canguro y puños elásticos. Tela suave y cálida para el invierno habanero.',
    materiales: 'Felpa 80% algodón / 20% poliéster',
    plazoEnvio: 'Envío en 5-7 días',
    precio: 32.0,
    tallas: ['S', 'M', 'L', 'XL'],
    colores: [NEGRO, ROJO],
    seed: 'egrem-merch-2',
  }),
  buildAccesorio({
    id: 'mock-mer-3',
    slug: 'taza-oficial-egrem',
    titulo: 'Taza Oficial EGREM',
    descripcion:
      'Taza de cerámica de 350ml con el emblema EGREM grabado. Ideal para el café de la mañana con sabor a música cubana. Resistente al lavavajillas.',
    materiales: 'Cerámica 350ml',
    plazoEnvio: 'Envío en 3-5 días',
    precio: 9.99,
    colores: [
      { nombre: 'Blanco', hex: '#ffffff', seed: 'egrem-merch-3' },
      { nombre: 'Negro', hex: '#1b1b1b', seed: 'egrem-merch-3b' },
    ],
  }),
  buildAccesorio({
    id: 'mock-mer-2',
    slug: 'gorra-logo-egrem',
    titulo: 'Gorra Logo EGREM',
    descripcion:
      'Gorra tipo snapback con el logo bordado de EGREM. Visera curva, correa ajustable y panel frontal estructurado. Un clásico para acompañar cualquier outfit.',
    materiales: 'Algodón',
    plazoEnvio: 'Envío en 3-5 días',
    precio: 12.0,
    colores: [
      { nombre: 'Negro', hex: '#1b1b1b', seed: 'egrem-merch-2' },
      { nombre: 'Rojo', hex: '#bc0100', seed: 'egrem-merch-1' },
    ],
  }),
  buildAccesorio({
    id: 'mock-mer-4',
    slug: 'vinilo-edicion-limitada',
    titulo: 'Vinilo Edición Limitada',
    descripcion:
      'Prensaje de 180g en vinilo de color negro. Edición numerada y limitada de EGREM para coleccionistas. Incluye funda interior con notas de producción.',
    materiales: 'Vinilo 180g',
    plazoEnvio: 'Envío en 7-10 días',
    precio: 39.99,
    colores: [
      { nombre: 'Negro', hex: '#111111', seed: 'egrem-merch-4' },
    ],
  }),
];

export function getMockProductoDetalle(slug: string): ProductoDetalle | null {
  return (
    MOCK_PRODUCTOS_DETALLE.find((p) => p.slug === slug || p.id === slug) ?? null
  );
}

/** Convierte un `ProductoDetalle` a `TiendaProducto` (adaptador compartido). */
export function mockProductoToTiendaProducto(p: ProductoDetalle): TiendaProducto {
  return productoATiendaProducto(p);
}

/** Productos relacionados: todos los demás del catálogo mock. */
export function getMockProductosRelacionados(slug: string): TiendaProducto[] {
  return MOCK_PRODUCTOS_DETALLE.filter((p) => p.slug !== slug).map(mockProductoToTiendaProducto);
}
