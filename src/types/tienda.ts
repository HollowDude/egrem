export type TiendaCategoria = 'musica' | 'merchandising' | 'entradas' | 'instrumentos' | 'libros';

/** Categorías con fuente de datos real hoy (el resto es visible pero inerte). */
export const TIENDA_CATEGORIAS_CON_DATOS: TiendaCategoria[] = [
  'musica',
  'merchandising',
  'entradas',
];

export type TiendaDisponibilidad = 'stock' | 'preventa' | 'agotado';

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
}
