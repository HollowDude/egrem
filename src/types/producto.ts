/**
 * Contrato de datos para la ficha de producto de merchandising.
 * Reemplaza/extiende `src/types/tienda.ts` (que solo tiene `TiendaProducto`,
 * el shape de tarjeta de listado). `ProductoDetalle` es para la ficha.
 *
 * Asume este contrato mientras Drupal no esté listo (ver Fase 1 del plan).
 */

export type TipoArticulo = 'prenda' | 'accesorio';

export interface ProductoColorOpcion {
  nombre: string;
  hex: string; // '#RRGGBB'
}

export interface ProductoVariacion {
  variationId: number; // id interno Drupal, va como purchased_entity_id al carrito
  uuid?: string; // UUID Drupal de la variación (modo real / MERCH_API_REAL)
  sku: string;
  talla: string | null; // solo prenda
  color: ProductoColorOpcion | null; // prenda y accesorio
  imagenVarianteUrl: string | null; // solo si accesorio usa "imagen" como dimensión
  precio: number | null;
  disponible: boolean;
  stock: number | null;
  imagenes: string[];
}

export interface ProductoDetalle {
  id: string;
  slug: string;
  titulo: string;
  tipo: TipoArticulo;
  descripcion: string;
  materiales: string; // HTML o texto plano, requerido por la HU
  plazoEnvio: string; // requerido por la HU
  imagenPrincipal: string | null;
  variaciones: ProductoVariacion[];
}

/** Alterna entre mock y fetch real sin tocar componentes (ver Fase 1). */
export const MERCH_API_REAL = import.meta.env.MERCH_API_REAL === 'true';
