import { describe, it, expect } from 'vitest';
import { procesarCheckout, type CheckoutPayload } from '../checkout';
import type { NhEventoDetalle } from '@/lib/nodehive';

function tier(sku: string, disponibles: number | null = null, precio = 25) {
  return {
    nombre: sku,
    sku,
    precio,
    descripcion: '',
    capacidad: null,
    disponibles,
    destacado: false,
    diasIds: ['d1'],
    zonaIds: ['z1'],
  };
}

function evento(tipos: ReturnType<typeof tier>[]): NhEventoDetalle {
  return {
    id: 'e1',
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
    programa: [
      { id: 'd1', titulo: 'D1', fecha: '2026-05-10', horario: '', descripcion: '', zonaId: null },
    ],
    lineup: [],
    tiposEntrada: tipos,
    eventosRelacionados: [],
    href: '/evento/1',
  };
}

const itemsValidos = [{ sku: 'GEN', diaId: 'd1', cantidad: 2 }];

describe('procesarCheckout', () => {
  it('rechaza sin items (400)', () => {
    const r = procesarCheckout({ items: [] }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rechaza item mal formado (400)', () => {
    const r = procesarCheckout({ items: [{ sku: '', diaId: 'd1', cantidad: 1 }] }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('item_invalido');
  });

  it('rechaza sku inexistente (409)', () => {
    const r = procesarCheckout({ items: itemsValidos }, evento([tier('OTRO')]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('sku_invalido');
  });

  it('rechaza entrada agotada (409)', () => {
    const r = procesarCheckout({ items: itemsValidos }, evento([tier('GEN', 0)]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('agotado');
  });

  it('ok y total recalculado server-side', () => {
    const r = procesarCheckout({ items: itemsValidos }, evento([tier('GEN', null, 25)]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toBe(50); // 25 × 2
  });

  it('ok sin revalidación cuando no hay evento (stub)', () => {
    const r = procesarCheckout({ items: itemsValidos }, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.total).toBeNull();
  });
});
