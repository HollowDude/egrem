import { describe, it, expect } from 'vitest';
import { productoATiendaProducto } from './productoAdapters';
import type { ProductoDetalle, ProductoVariacion, ProductoTiendaStock } from '@/types/producto';

function variacion(sku: string, stockPorTienda: ProductoTiendaStock[] | null): ProductoVariacion {
  return {
    variationId: 1,
    uuid: sku,
    sku,
    talla: null,
    color: null,
    imagenVarianteUrl: null,
    precio: 10,
    disponible: true,
    stock: 5,
    stockPorTienda,
    imagenes: [],
    edicion: null,
    formato: null,
  };
}

const egrem = { id: '2', label: 'Egrem' };
const prueba = { id: '3', label: 'Tienda prueba' };

describe('productoATiendaProducto.tiendasConStock', () => {
  it('une tiendas con stock>0 en cualquier variación', () => {
    const detalle: ProductoDetalle = {
      id: 'p1',
      slug: 'p1',
      titulo: 'P',
      tipo: 'prenda',
      descripcion: '',
      materiales: '',
      plazoEnvio: '',
      imagenPrincipal: null,
      variaciones: [
        variacion('A', [
          { tienda: egrem, cantidad: 3, ilimitado: false },
          { tienda: prueba, cantidad: 0, ilimitado: false },
        ]),
        variacion('B', [
          { tienda: egrem, cantidad: 0, ilimitado: false },
          { tienda: prueba, cantidad: 2, ilimitado: false },
        ]),
      ],
    };
    const p = productoATiendaProducto(detalle);
    expect(p.tiendasConStock?.map((t) => t.id).sort()).toEqual(['2', '3']);
  });

  it('ilimitado cuenta como con stock', () => {
    const detalle: ProductoDetalle = {
      id: 'p2',
      slug: 'p2',
      titulo: 'P',
      tipo: 'accesorio',
      descripcion: '',
      materiales: '',
      plazoEnvio: '',
      imagenPrincipal: null,
      variaciones: [
        variacion('A', [{ tienda: egrem, cantidad: null, ilimitado: true }]),
      ],
    };
    const p = productoATiendaProducto(detalle);
    expect(p.tiendasConStock?.map((t) => t.id)).toEqual(['2']);
  });

  it('sin stock en ninguna tienda -> vacío', () => {
    const detalle: ProductoDetalle = {
      id: 'p3',
      slug: 'p3',
      titulo: 'P',
      tipo: 'accesorio',
      descripcion: '',
      materiales: '',
      plazoEnvio: '',
      imagenPrincipal: null,
      variaciones: [
        variacion('A', [
          { tienda: egrem, cantidad: 0, ilimitado: false },
          { tienda: prueba, cantidad: 0, ilimitado: false },
        ]),
      ],
    };
    const p = productoATiendaProducto(detalle);
    expect(p.tiendasConStock).toEqual([]);
  });
});
