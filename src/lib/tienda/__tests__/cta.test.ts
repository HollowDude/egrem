import { describe, it, expect } from 'vitest';
import { resolveCtaCompra } from '../cta';
import type { NhEventoDetalle } from '@/lib/nodehive';
import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive';

function tipo(sku: string, diasIds: string[]): NhEventoTipoEntrada {
  return {
    nombre: sku,
    sku,
    precio: 10,
    descripcion: '',
    capacidad: null,
    disponibles: null,
    destacado: false,
    diasIds,
    zonaIds: [],
  };
}

function dia(id: string): NhEventoProgramaDia {
  return { id, titulo: id, fecha: '2026-05-10', horario: '', descripcion: '', zonaId: null };
}

function evento(programa: NhEventoProgramaDia[], tipos: NhEventoTipoEntrada[]): NhEventoDetalle {
  return {
    id: 'e',
    internalId: 1,
    parentId: '',
    bundle: 'evento',
    title: 'E',
    categoria: '',
    descripcion: '',
    heroImage: null,
    fechaInicio: '',
    fechaFin: '',
    hora: '',
    local: null,
    lugarTexto: '',
    esInternacional: false,
    programa,
    lineup: [],
    tiposEntrada: tipos,
    eventosRelacionados: [],
    href: '/evento/1',
  };
}

describe('resolveCtaCompra', () => {
  it('compra directa cuando hay exactamente 1 día × 1 tier', () => {
    const e = evento([dia('d1')], [tipo('GEN', ['d1'])]);
    const cta = resolveCtaCompra(e, 'es');
    expect(cta.tipo).toBe('checkout_directo');
    if (cta.tipo === 'checkout_directo') {
      expect(cta.sku).toBe('GEN');
      expect(cta.diaId).toBe('d1');
      expect(cta.href).toContain('/checkout/entrada?sku=GEN&dia=d1');
    }
  });

  it('ver tienda cuando hay varios tiers para el mismo día', () => {
    const e = evento([dia('d1')], [tipo('GEN', ['d1']), tipo('VIP', ['d1'])]);
    const cta = resolveCtaCompra(e, 'es');
    expect(cta.tipo).toBe('ver_tienda');
    if (cta.tipo === 'ver_tienda') {
      expect(cta.href).toContain('/tienda/entrada/1');
    }
  });

  it('ver tienda cuando hay varios días', () => {
    const e = evento([dia('d1'), dia('d2')], [tipo('GEN', ['d1', 'd2'])]);
    const cta = resolveCtaCompra(e, 'es');
    expect(cta.tipo).toBe('ver_tienda');
  });

  it('ver tienda (no compra) cuando el evento ya pasó', () => {
    const e = evento([dia('d1')], [tipo('GEN', ['d1'])]);
    const cta = resolveCtaCompra(e, 'es', true);
    expect(cta.tipo).toBe('ver_tienda');
  });

  it('ver tienda cuando no hay tipos de entrada', () => {
    const e = evento([dia('d1')], []);
    const cta = resolveCtaCompra(e, 'es');
    expect(cta.tipo).toBe('ver_tienda');
  });
});
