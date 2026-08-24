/**
 * Lógica pura de selección de variante de producto (merchandising).
 * No depende de React ni del DOM: se testea directamente
 * (ver productoSeleccion.test.ts).
 *
 * La selección es por atributos (`talla`/`color`) y se resuelve a una
 * `ProductoVariacion` concreta. Una variación resuelta pero no disponible
 * se trata como no apta para añadir al carrito.
 */
import type {
  ProductoColorOpcion,
  ProductoDetalle,
  ProductoVariacion,
  TipoArticulo,
} from '@/types/producto';

export type SeleccionAtributos = { talla?: string; color?: string };

/** Dimensiones que el usuario debe elegir según el tipo de artículo. */
export function dimensionesRequeridas(tipo: TipoArticulo): Array<'talla' | 'color'> {
  return tipo === 'prenda' ? ['talla', 'color'] : ['color'];
}

/** ¿El usuario seleccionó todas las dimensiones requeridas? */
export function seleccionCompleta(tipo: TipoArticulo, seleccion: SeleccionAtributos): boolean {
  return dimensionesRequeridas(tipo).every((d) => !!seleccion[d]);
}

/**
 * Resuelve la variación exacta a partir de la selección.
 * Devuelve `null` si la selección es ambigua (falta una dimensión o hay
 * varias combinaciones posibles), si no existe la combinación, o si la
 * variación no está disponible (Escenario 3 de la HU).
 */
export function resolverVariacion(
  variaciones: ProductoVariacion[],
  seleccion: SeleccionAtributos,
): ProductoVariacion | null {
  const candidatos = variaciones.filter(
    (v) =>
      (!seleccion.talla || v.talla === seleccion.talla) &&
      (!seleccion.color || v.color?.nombre === seleccion.color),
  );
  // Ambiguo (falta una dimensión) o inexistente → no se puede resolver.
  if (candidatos.length !== 1) return null;
  const match = candidatos[0];
  if (!match.disponible) return null;
  return match;
}

/** Lista de tallas únicas presentes en las variaciones (orden de aparición). */
export function tallasDisponibles(variaciones: ProductoVariacion[]): string[] {
  const set = new Set<string>();
  for (const v of variaciones) if (v.talla) set.add(v.talla);
  return [...set];
}

/** Lista de colores únicos presentes en las variaciones. */
export function coloresDisponibles(variaciones: ProductoVariacion[]): ProductoColorOpcion[] {
  const map = new Map<string, ProductoColorOpcion>();
  for (const v of variaciones) if (v.color) map.set(v.color.nombre, v.color);
  return [...map.values()];
}

/**
 * ¿Existe alguna variación disponible para la combinación dada?
 * Se usa para marcar tallas/colores "no disponibles" en la UI sin ocultarlos.
 */
export function combinacionDisponible(
  variaciones: ProductoVariacion[],
  talla: string | undefined,
  color: string | undefined,
): boolean {
  return variaciones.some(
    (v) =>
      v.disponible &&
      (!talla || v.talla === talla) &&
      (!color || v.color?.nombre === color),
  );
}

/** Stock disponible para una combinación (o null si no aplica). */
export function stockCombinacion(
  variaciones: ProductoVariacion[],
  talla: string | undefined,
  color: string | undefined,
): number | null {
  const match = variaciones.find(
    (v) =>
      v.disponible &&
      (!talla || v.talla === talla) &&
      (!color || v.color?.nombre === color),
  );
  return match?.stock ?? null;
}

/** Helper de tipo para el array de variaciones de un producto. */
export type { ProductoDetalle, ProductoVariacion, ProductoColorOpcion };
