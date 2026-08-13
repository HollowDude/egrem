import type { TiendaProducto } from '@/types/tienda';
import type { NhEventoListItem } from '@/lib/nodehive';

/**
 * Catálogo mock para las categorías activas sin inventario real en Drupal todavía
 * (música / merchandising). Las entradas se normalizan desde NhEventoListItem.
 * Reemplazable por fetchers reales cuando exista el catálogo de productos.
 */
export const MOCK_PRODUCTOS: TiendaProducto[] = [
  // ── Música ───────────────────────────────────────────────
  {
    id: 'mock-mus-1',
    titulo: 'Sabor a Cuba Vol. 1',
    subtitulo: 'Varios Artistas',
    precio: 24.99,
    imagen: 'https://picsum.photos/seed/egrem-musica-1/600/600',
    badge: 'Novedad',
    categoria: 'musica',
    disponibilidad: 'stock',
  },
  {
    id: 'mock-mus-2',
    titulo: 'Buena Vista Social Club',
    subtitulo: 'Álbum Remasterizado',
    precio: 29.99,
    imagen: 'https://picsum.photos/seed/egrem-musica-2/600/600',
    categoria: 'musica',
    disponibilidad: 'stock',
  },
  {
    id: 'mock-mus-3',
    titulo: 'Cantares del Mar',
    subtitulo: 'Orquesta EGREM',
    precio: 19.99,
    imagen: 'https://picsum.photos/seed/egrem-musica-3/600/600',
    badge: 'Oferta',
    categoria: 'musica',
    disponibilidad: 'stock',
  },
  {
    id: 'mock-mus-4',
    titulo: 'Piano Jazz en La Habana',
    subtitulo: 'Trío Instrumental',
    precio: 22.5,
    imagen: 'https://picsum.photos/seed/egrem-musica-4/600/600',
    categoria: 'musica',
    disponibilidad: 'stock',
  },

  // ── Merchandising ────────────────────────────────────────
  {
    id: 'mock-mer-1',
    titulo: 'Camiseta EGREM',
    subtitulo: 'Algodón Premium',
    precio: 15.0,
    imagen: 'https://picsum.photos/seed/egrem-merch-1/600/600',
    badge: 'Novedad',
    categoria: 'merchandising',
    disponibilidad: 'stock',
  },
  {
    id: 'mock-mer-2',
    titulo: 'Gorra Logo EGREM',
    subtitulo: 'Ajustable',
    precio: 12.0,
    imagen: 'https://picsum.photos/seed/egrem-merch-2/600/600',
    categoria: 'merchandising',
    disponibilidad: 'stock',
  },
  {
    id: 'mock-mer-3',
    titulo: 'Taza Oficial EGREM',
    subtitulo: 'Cerámica 350ml',
    precio: 9.99,
    imagen: 'https://picsum.photos/seed/egrem-merch-3/600/600',
    badge: 'Oferta',
    categoria: 'merchandising',
    disponibilidad: 'preventa',
  },
  {
    id: 'mock-mer-4',
    titulo: 'Vinilo Edición Limitada',
    subtitulo: 'Prensaje 180g',
    precio: 39.99,
    imagen: 'https://picsum.photos/seed/egrem-merch-4/600/600',
    categoria: 'merchandising',
    disponibilidad: 'preventa',
  },
];

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
