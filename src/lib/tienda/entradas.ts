import type { TiendaProducto } from '@/types/tienda';
import type { NhEventoListItem } from '@/lib/nodehive';

/** Normaliza un evento (entrada) del Drupal a la forma genérica de producto. */
export function entradaToProducto(e: NhEventoListItem): TiendaProducto {
  return {
    id: e.id,
    titulo: e.title,
    subtitulo: e.artistas.length ? e.artistas.join(', ') : e.lugarTexto,
    precio: e.precioDesde,
    imagen: e.thumbnail?.url ?? null,
    badge: e.agotado ? 'Agotado' : undefined,
    categoria: 'entradas',
    disponibilidad: e.agotado ? 'agotado' : 'stock',
    href: e.href.replace(/\/evento\//, '/tienda/entrada/'),
  };
}
