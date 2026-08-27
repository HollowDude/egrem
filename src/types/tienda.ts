import type { ProductoVariacion, TipoArticulo } from './producto';

export type TiendaCategoria = 'discos' | 'merchandising' | 'entradas' | 'instrumentos' | 'libros';

/** Categorías con fuente de datos real. */
export const TIENDA_CATEGORIAS_CON_DATOS: TiendaCategoria[] = [
  'discos',
  'merchandising',
  'entradas',
  'instrumentos',
  'libros',
];

export type TiendaDisponibilidad = 'stock' | 'preventa' | 'agotado';

/** Tienda física con stock multitienda (Egrem, Tienda prueba, etc.). */
export interface TiendaInfo {
  id: string;
  label: string;
}

/** Resumen de una variación para el listado: suficiente para swatches + foto + precio. */
export interface TiendaProductoVariacionResumen {
  color: { nombre: string; hex: string } | null;
  talla: string | null;
  edicion: string | null;
  formato: string | null;
  imagen: string | null;
  disponible: boolean;
  precio: number | null;
}

export interface TiendaProducto {
  id: string;
  titulo: string;
  subtitulo: string;
  precio: number | null;
  imagen: string | null;
  badge?: string;
  categoria: TiendaCategoria;
  disponibilidad: TiendaDisponibilidad;
  /** Enlace a la página de detalle del producto (p. ej. entradas). */
  href?: string;
  /** Facets dinámicos (solo cuando aplican): tallas y colores del merch. */
  tallas?: string[];
  colores?: string[];
  /** Variaciones colapsadas por color (solo merchandising) para swatches + preview. */
  variaciones?: TiendaProductoVariacionResumen[];
  /** Tipo de artículo (bundle de Drupal) — necesario para el alta rápida. */
  tipo?: TipoArticulo;
  /**
   * Catálogo completo de variaciones para resolver el alta rápida desde el
   * listado (incluye uuid, atributos y disponibilidad). Ausente en entradas.
   */
  catalogo?: ProductoVariacion[];
  /** Tiendas donde el producto tiene stock>0 en al menos una variación. */
  tiendasConStock?: TiendaInfo[];
}
