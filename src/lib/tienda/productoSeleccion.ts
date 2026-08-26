/**
 * Lógica pura de selección de variante de producto (merchandising, libros,
 * instrumentos, discos).
 * No depende de React ni del DOM: se testea directamente
 * (ver productoSeleccion.test.ts).
 *
 * La selección es por atributos (`talla`/`color`/`edicion`/`formato`) y se
 * resuelve a una `ProductoVariacion` concreta. Una variación resuelta pero no
 * disponible se trata como no apta para añadir al carrito.
 */
import type {
  ProductoColorOpcion,
  ProductoDetalle,
  ProductoVariacion,
  TipoArticulo,
} from '@/types/producto';

export type SeleccionAtributos = {
  talla?: string;
  color?: string;
  edicion?: string;
  formato?: string;
};

type Dimension = keyof SeleccionAtributos;

function coincide(v: ProductoVariacion, sel: SeleccionAtributos): boolean {
  if (sel.talla && v.talla !== sel.talla) return false;
  if (sel.color && v.color?.nombre !== sel.color) return false;
  if (sel.edicion && v.edicion !== sel.edicion) return false;
  if (sel.formato && v.formato !== sel.formato) return false;
  return true;
}

/** Dimensiones que el usuario debe elegir según el tipo de artículo. */
export function dimensionesRequeridas(tipo: TipoArticulo): Dimension[] {
  switch (tipo) {
    case 'prenda':
      return ['talla', 'color'];
    case 'accesorio':
      return ['color'];
    case 'libro':
      return ['edicion'];
    case 'disco':
      return ['formato'];
    case 'instrumento':
      return [];
  }
}

/** ¿El usuario seleccionó todas las dimensiones requeridas? */
export function seleccionCompleta(tipo: TipoArticulo, seleccion: SeleccionAtributos): boolean {
  return dimensionesRequeridas(tipo).every((d) => !!seleccion[d]);
}

function opcionesDeDimension(d: Dimension, variaciones: ProductoVariacion[]): string[] {
  switch (d) {
    case 'talla':
      return tallasDisponibles(variaciones);
    case 'color':
      return coloresDisponibles(variaciones).map((c) => c.nombre);
    case 'edicion':
      return edicionesDisponibles(variaciones);
    case 'formato':
      return formatosDisponibles(variaciones);
  }
}

/**
 * Selección por defecto: preselecciona las dimensiones que tienen UNA SOLA
 * opción disponible (p. ej. un accesorio con un único color). Así el botón de
 * añadir al carrito queda habilitado de inmediato, sin que el usuario tenga que
 * atravesar el paso de elegir variante. No preselecciona opciones no disponibles.
 */
export function seleccionPorDefecto(
  tipo: TipoArticulo,
  variaciones: ProductoVariacion[],
): SeleccionAtributos {
  const sel: SeleccionAtributos = {};
  for (const d of dimensionesRequeridas(tipo)) {
    const opciones = opcionesDeDimension(d, variaciones);
    if (opciones.length === 1) {
      const unica = opciones[0];
      const parcial: SeleccionAtributos = { ...sel, [d]: unica };
      if (
        combinacionDisponible(
          variaciones,
          parcial.talla,
          parcial.color,
          parcial.edicion,
          parcial.formato,
        )
      ) {
        sel[d] = unica;
      }
    }
  }
  return sel;
}

/**
 * Resuelve la variación exacta a partir de la selección.
 * Devuelve `null` si la selección es ambigua (falta una dimensión o hay
 * varias combinaciones posibles), si no existe la combinación, o si la
 * variación no está disponible.
 */
export function resolverVariacion(
  variaciones: ProductoVariacion[],
  seleccion: SeleccionAtributos,
): ProductoVariacion | null {
  const candidatos = variaciones.filter((v) => coincide(v, seleccion));
  if (candidatos.length === 0) return null;
  // Selección exacta y única.
  if (candidatos.length === 1) {
    const match = candidatos[0];
    return match.disponible ? match : null;
  }
  // Ambigua (varias variaciones comparten el mismo valor de atributo, p. ej. dos
  // "CD"). Nos quedamos con la única disponible; si hay varias disponibles o
  // ninguna, no podemos resolver y devolvemos null para que el UI lo gestione.
  const disponibles = candidatos.filter((v) => v.disponible);
  if (disponibles.length === 1) return disponibles[0];
  return null;
}

/**
 * Previsualización siempre-disponible para la UI (galería, foto, precio).
 * SIEMPRE devuelve una variación para mostrar, incluso con selección parcial
 * o vacía. Prioridad: coincidencia exacta > primera disponible > primera.
 * Para instrumentos (sin dimensiones requeridas) resuelve directo la primera
 * variación disponible.
 */
export function previsualizarVariacion(
  variaciones: ProductoVariacion[],
  seleccion: SeleccionAtributos,
): ProductoVariacion | null {
  if (variaciones.length === 0) return null;
  const candidatos = variaciones.filter((v) => coincide(v, seleccion));
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) return candidatos.find((v) => v.disponible) ?? candidatos[0];
  return variaciones.find((v) => v.disponible) ?? variaciones[0];
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

/** Lista de ediciones únicas (libro). */
export function edicionesDisponibles(variaciones: ProductoVariacion[]): string[] {
  const set = new Set<string>();
  for (const v of variaciones) if (v.edicion) set.add(v.edicion);
  return [...set];
}

/** Lista de formatos únicos (disco). */
export function formatosDisponibles(variaciones: ProductoVariacion[]): string[] {
  const set = new Set<string>();
  for (const v of variaciones) if (v.formato) set.add(v.formato);
  return [...set];
}

/**
 * ¿Existe alguna variación disponible para la combinación dada?
 * Se usa para marcar tallas/colores/ediciones/formatos "no disponibles" en la
 * UI sin ocultarlos.
 */
export function combinacionDisponible(
  variaciones: ProductoVariacion[],
  talla: string | undefined,
  color: string | undefined,
  edicion?: string | undefined,
  formato?: string | undefined,
): boolean {
  return variaciones.some(
    (v) =>
      v.disponible &&
      (!talla || v.talla === talla) &&
      (!color || v.color?.nombre === color) &&
      (!edicion || v.edicion === edicion) &&
      (!formato || v.formato === formato),
  );
}

/** Stock disponible para una combinación (o null si no aplica). */
export function stockCombinacion(
  variaciones: ProductoVariacion[],
  talla: string | undefined,
  color: string | undefined,
  edicion?: string | undefined,
  formato?: string | undefined,
): number | null {
  const match = variaciones.find(
    (v) =>
      v.disponible &&
      (!talla || v.talla === talla) &&
      (!color || v.color?.nombre === color) &&
      (!edicion || v.edicion === edicion) &&
      (!formato || v.formato === formato),
  );
  return match?.stock ?? null;
}

/** Helper de tipo para el array de variaciones de un producto. */
export type { ProductoDetalle, ProductoVariacion, ProductoColorOpcion };
