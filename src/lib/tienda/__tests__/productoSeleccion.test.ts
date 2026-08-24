import { describe, it, expect } from 'vitest';
import {
  dimensionesRequeridas,
  seleccionCompleta,
  resolverVariacion,
  tallasDisponibles,
  coloresDisponibles,
  combinacionDisponible,
  stockCombinacion,
} from '../productoSeleccion';
import type { ProductoColorOpcion, ProductoDetalle, ProductoVariacion } from '@/types/producto';

const NEGRO: ProductoColorOpcion = { nombre: 'Negro', hex: '#1b1b1b' };
const ROJO: ProductoColorOpcion = { nombre: 'Rojo', hex: '#bc0100' };

function variacion(partial: Partial<ProductoVariacion> & { sku: string }): ProductoVariacion {
  return {
    variationId: Math.floor(Math.random() * 100000),
    talla: 'M',
    color: NEGRO,
    imagenVarianteUrl: null,
    precio: 18.5,
    disponible: true,
    stock: 10,
    imagenes: [],
    ...partial,
  };
}

const PRENDA: ProductoDetalle = {
  id: 'p1',
  slug: 'camiseta',
  titulo: 'Camiseta',
  tipo: 'prenda',
  descripcion: '',
  materiales: '',
  plazoEnvio: '',
  imagenPrincipal: null,
  variaciones: [
    variacion({ sku: 'S-NEGRO', talla: 'S', color: NEGRO }),
    variacion({ sku: 'M-NEGRO', talla: 'M', color: NEGRO }),
    variacion({ sku: 'M-ROJO', talla: 'M', color: ROJO }),
    variacion({ sku: 'L-ROJO', talla: 'L', color: ROJO, disponible: false, stock: 0 }),
  ],
};

const ACCESORIO: ProductoDetalle = {
  id: 'a1',
  slug: 'taza',
  titulo: 'Taza',
  tipo: 'accesorio',
  descripcion: '',
  materiales: '',
  plazoEnvio: '',
  imagenPrincipal: null,
  variaciones: [
    variacion({ sku: 'TAZA-NEGRO', talla: null, color: NEGRO }),
    variacion({ sku: 'TAZA-ROJO', talla: null, color: ROJO }),
  ],
};

describe('dimensionesRequeridas', () => {
  it('prenda requiere talla y color', () => {
    expect(dimensionesRequeridas('prenda')).toEqual(['talla', 'color']);
  });
  it('accesorio requiere solo color', () => {
    expect(dimensionesRequeridas('accesorio')).toEqual(['color']);
  });
});

describe('seleccionCompleta (Escenario 1 y 2)', () => {
  it('prenda incompleta cuando falta una dimensión', () => {
    expect(seleccionCompleta('prenda', { talla: 'M' })).toBe(false);
    expect(seleccionCompleta('prenda', { color: 'Negro' })).toBe(false);
    expect(seleccionCompleta('prenda', {})).toBe(false);
  });
  it('prenda completa con talla y color', () => {
    expect(seleccionCompleta('prenda', { talla: 'M', color: 'Negro' })).toBe(true);
  });
  it('accesorio completo con solo color', () => {
    expect(seleccionCompleta('accesorio', { color: 'Negro' })).toBe(true);
    expect(seleccionCompleta('accesorio', {})).toBe(false);
  });
});

describe('resolverVariacion (Escenario 1, 2 y 3)', () => {
  it('selección completa resuelve la variación correcta', () => {
    const v = resolverVariacion(PRENDA.variaciones, { talla: 'M', color: 'Rojo' });
    expect(v?.sku).toBe('M-ROJO');
  });

  it('falta una dimensión → null', () => {
    expect(resolverVariacion(PRENDA.variaciones, { talla: 'M' })).toBeNull();
  });

  it('combinación inexistente → null', () => {
    expect(resolverVariacion(PRENDA.variaciones, { talla: 'S', color: 'Rojo' })).toBeNull();
  });

  it('variación resuelta pero no disponible → null (no apta para el carrito)', () => {
    const v = resolverVariacion(PRENDA.variaciones, { talla: 'L', color: 'Rojo' });
    expect(v).toBeNull();
  });

  it('accesorio resuelve por color sin talla', () => {
    const v = resolverVariacion(ACCESORIO.variaciones, { color: 'Rojo' });
    expect(v?.sku).toBe('TAZA-ROJO');
  });
});

describe('helpers de disponibilidad', () => {
  it('lista tallas y colores únicos', () => {
    expect(tallasDisponibles(PRENDA.variaciones)).toEqual(['S', 'M', 'L']);
    expect(coloresDisponibles(PRENDA.variaciones).map((c) => c.nombre)).toEqual(['Negro', 'Rojo']);
  });

  it('combinacionDisponible ignora la variación agotada', () => {
    expect(combinacionDisponible(PRENDA.variaciones, 'L', 'Rojo')).toBe(false);
    expect(combinacionDisponible(PRENDA.variaciones, 'M', 'Rojo')).toBe(true);
  });

  it('stockCombinacion devuelve el stock de la combinación', () => {
    expect(stockCombinacion(PRENDA.variaciones, 'M', 'Negro')).toBe(10);
    expect(stockCombinacion(PRENDA.variaciones, 'L', 'Rojo')).toBeNull();
  });
});
