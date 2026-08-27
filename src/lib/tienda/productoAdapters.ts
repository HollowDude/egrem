import type { ProductoDetalle, ProductoVariacion } from '@/types/producto';
import type {
  TiendaProducto,
  TiendaProductoVariacionResumen,
  TiendaCategoria,
  TiendaInfo,
} from '@/types/tienda';
import { tallasDisponibles, coloresDisponibles } from '@/lib/tienda/productoSeleccion';

/** Union de tiendas con stock>0 en al menos una variacion del producto. */
function calcularTiendasConStock(variaciones: ProductoVariacion[]): TiendaInfo[] {
  const map = new Map<string, TiendaInfo>();
  for (const v of variaciones) {
    for (const s of v.stockPorTienda ?? []) {
      const conStock = s.ilimitado || (s.cantidad ?? 0) > 0;
      if (conStock) map.set(s.tienda.id, s.tienda);
    }
  }
  return [...map.values()];
}

/**
 * Colapsa las variaciones en un resumen por color (una por color), conservando
 * imagen y disponibilidad — igual que `coloresDisponibles` pero con más datos
 * para los swatches del listado.
 */
function resumenVariaciones(variaciones: ProductoVariacion[]): TiendaProductoVariacionResumen[] {
  const porColor = new Map<string, TiendaProductoVariacionResumen>();
  for (const v of variaciones) {
    const key = v.color?.nombre ?? '__sin_color__';
    const resumen: TiendaProductoVariacionResumen = {
      color: v.color ? { nombre: v.color.nombre, hex: v.color.hex } : null,
      talla: v.talla ?? null,
      edicion: v.edicion ?? null,
      formato: v.formato ?? null,
      imagen: v.imagenVarianteUrl ?? v.imagenes[0] ?? null,
      disponible: v.disponible,
      precio: v.precio ?? null,
    };
    const existente = porColor.get(key);
    if (!existente) {
      porColor.set(key, resumen);
    } else if (!existente.disponible && resumen.disponible) {
      porColor.set(key, resumen);
    } else if (existente.disponible === resumen.disponible && !existente.imagen && resumen.imagen) {
      porColor.set(key, resumen);
    }
  }
  return [...porColor.values()];
}

/**
 * Adaptador genérico `ProductoDetalle → TiendaProducto`.
 * No tiene nada de "mock": lo usan tanto los datos de prueba como el fetcher
 * real de Drupal (`comercio.ts`), para no duplicar la lógica de mapeo.
 */
export function productoATiendaProducto(p: ProductoDetalle): TiendaProducto {
  const primera = p.variaciones[0];
  const imagen =
    p.imagenPrincipal ?? primera?.imagenes[0] ?? primera?.imagenVarianteUrl ?? null;
  const precio = primera?.precio ?? null;
  const subtitulo: Record<string, string> = {
    prenda: 'Merchandising',
    accesorio: 'Accesorio',
    libro: 'Libro',
    instrumento: 'Instrumento',
    disco: 'Disco',
  };
  const categoria: TiendaCategoria =
    p.tipo === 'disco'
      ? 'discos'
      : p.tipo === 'libro'
        ? 'libros'
        : p.tipo === 'instrumento'
          ? 'instrumentos'
          : 'merchandising';
  return {
    id: p.id,
    titulo: p.titulo,
    subtitulo: subtitulo[p.tipo] ?? 'Producto',
    precio,
    imagen,
    badge: undefined,
    categoria,
    disponibilidad: 'stock',
    href: `/tienda/producto/${p.slug}`,
    tallas: p.tipo === 'prenda' ? tallasDisponibles(p.variaciones) : undefined,
    colores: coloresDisponibles(p.variaciones).map((c) => c.nombre),
    variaciones: resumenVariaciones(p.variaciones),
    tipo: p.tipo,
    catalogo: p.variaciones,
    tiendasConStock: calcularTiendasConStock(p.variaciones),
  };
}
