/**
 * Contrato de datos para la ficha de producto de merchandising.
 * Reemplaza/extiende `src/types/tienda.ts` (que solo tiene `TiendaProducto`,
 * el shape de tarjeta de listado). `ProductoDetalle` es para la ficha.
 *
 * Asume este contrato mientras Drupal no esté listo (ver Fase 1 del plan).
 */

export type TipoArticulo = 'prenda' | 'accesorio' | 'libro' | 'instrumento' | 'disco';

import type { TiendaInfo } from './tienda';

/** Stock de una variación desglosado por tienda. */
export interface ProductoTiendaStock {
  tienda: TiendaInfo;
  /** null = ilimitado. */
  cantidad: number | null;
  ilimitado: boolean;
}

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
  imagenVarianteUrl: string | null;
  precio: number | null;
  disponible: boolean;
  stock: number | null;
  /** Stock desglosado por tienda (null = sin datos multitienda). */
  stockPorTienda?: ProductoTiendaStock[] | null;
  imagenes: string[];
  // Selectores (atributos Commerce, taxonomías)
  edicion: string | null; // libro (taxonomy_term--edicion)
  formato: string | null; // disco (taxonomy_term--formato)
  // Ficha técnica — a nivel de variación (Drupal no tiene campos custom a nivel de producto)
  editorial?: string | null; // libro
  paginas?: number | null; // libro
  autor?: string | null; // libro
  isbn?: string | null; // libro
  garantia?: string | null; // instrumento
  accesoriosIncluidos?: string | null; // instrumento
  materiales?: string | null; // instrumento (y genérico)
  artista?: { nombre: string; href: string } | null; // disco → node--artista
  lanzamientoRelacionado?: {
    titulo: string;
    href: string;
    portada: string | null;
    sello?: { nombre: string } | null; // taxonomy_term--sello_discografico (en el album)
  } | null; // disco → node--album
}

export interface ProductoDetalle {
  id: string;
  slug: string;
  titulo: string;
  tipo: TipoArticulo;
  descripcion: string;
  materiales: string; // heredado de la 1ª variación si aplica
  plazoEnvio: string;
  imagenPrincipal: string | null;
  variaciones: ProductoVariacion[];
}

/** Alterna entre mock y fetch real sin tocar componentes (ver Fase 1). */
export const MERCH_API_REAL = import.meta.env.MERCH_API_REAL === 'true';
