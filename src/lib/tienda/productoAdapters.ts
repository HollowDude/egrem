import type { ProductoDetalle } from '@/types/producto';
import type { TiendaProducto } from '@/types/tienda';
import { tallasDisponibles, coloresDisponibles } from '@/lib/tienda/productoSeleccion';

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
  return {
    id: p.id,
    titulo: p.titulo,
    subtitulo: p.tipo === 'prenda' ? 'Merchandising' : 'Accesorio',
    precio,
    imagen,
    badge: undefined,
    categoria: 'merchandising',
    disponibilidad: 'stock',
    href: `/tienda/producto/${p.slug}`,
    tallas: p.tipo === 'prenda' ? tallasDisponibles(p.variaciones) : undefined,
    colores: coloresDisponibles(p.variaciones).map((c) => c.nombre),
  };
}
