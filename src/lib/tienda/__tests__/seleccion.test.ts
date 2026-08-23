import { describe, it, expect } from 'vitest';
import {
  agruparTiers,
  calcularResumen,
  totalCombinaciones,
  type SeleccionPorSku,
} from '../seleccion';
import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive/eventos';

const DIA_1: NhEventoProgramaDia = {
  id: 'd1',
  titulo: 'Día 1',
  fecha: '2026-05-10',
  horario: '18:00',
  descripcion: '',
  zonaId: 'z1',
};

const DIA_2: NhEventoProgramaDia = {
  id: 'd2',
  titulo: 'Día 2',
  fecha: '2026-05-11',
  horario: '19:00',
  descripcion: '',
  zonaId: 'z2',
};

function tier(partial: Partial<NhEventoTipoEntrada> & { sku: string }): NhEventoTipoEntrada {
  return {
    nombre: partial.sku,
    precio: 25,
    descripcion: '',
    capacidad: null,
    disponibles: null,
    destacado: false,
    diasIds: [],
    diasResueltos: [],
    zonaIds: [],
    ...partial,
  };
}

/** GEN cubre ambos días (pase combinado); VIP solo el día 2. */
const GEN = tier({ sku: 'GEN', precio: 60, diasIds: ['d1', 'd2'] });
const VIP = tier({ sku: 'VIP', precio: 80, diasIds: ['d2'] });

describe('agruparTiers', () => {
  it('un tier multi-día aparece UNA sola vez, en multiDia — nunca dentro de las tarjetas de día', () => {
    // Regresión del bug original: tiersPorDia duplicaba GEN en d1 Y d2.
    const grupos = agruparTiers([DIA_1, DIA_2], [GEN, VIP]);
    expect(grupos.porDia[0].tiers.map((t) => t.sku)).toEqual([]); // d1 sin tiers de un día
    expect(grupos.porDia[1].tiers.map((t) => t.sku)).toEqual(['VIP']);
    const skusEnPorDia = grupos.porDia.flatMap((o) => o.tiers.map((t) => t.sku));
    expect(skusEnPorDia).not.toContain('GEN');
    expect(grupos.multiDia).toHaveLength(1);
    expect(grupos.multiDia[0].tier.sku).toBe('GEN');
  });

  it('resuelve los días reales de un pase combinado contra el programa', () => {
    const grupos = agruparTiers([DIA_1, DIA_2], [GEN]);
    expect(grupos.multiDia[0].dias).toEqual([DIA_1, DIA_2]);
  });

  it('deja días con lista vacía cuando no tienen tier de un solo día', () => {
    const grupos = agruparTiers([DIA_1], [GEN]);
    expect(grupos.porDia[0].tiers).toHaveLength(0);
    expect(grupos.multiDia).toHaveLength(1);
  });

  it('ignora ids de día que no existen en el programa', () => {
    const fantasma = tier({ sku: 'FAN', diasIds: ['d1', 'no-existe'] });
    const grupos = agruparTiers([DIA_1], [fantasma]);
    expect(grupos.multiDia[0].dias).toEqual([DIA_1]);
  });
});

describe('calcularResumen (selección por SKU)', () => {
  it('suma total y líneas desde un Record sku→cantidad', () => {
    const seleccion: SeleccionPorSku = { VIP: 2, GEN: 1 };
    const res = calcularResumen(seleccion, [GEN, VIP]);
    // GEN 1 × 60 + VIP 2 × 80 = 220
    expect(res.total).toBe(220);
    expect(res.lineas).toHaveLength(2);
    expect(res.combinaciones).toBe(2);
    expect(res.hasNullPrice).toBe(false);
  });

  it('cada SKU produce exactamente una línea — no existe doble conteo por construcción', () => {
    const seleccion: SeleccionPorSku = { GEN: 3 };
    const res = calcularResumen(seleccion, [GEN, VIP]);
    expect(res.lineas).toHaveLength(1);
    expect(res.lineas[0].cantidad).toBe(3);
    expect(res.lineas[0].subtotal).toBe(180);
  });

  it('marca hasNullPrice y total null cuando un tier no tiene precio (Consultar)', () => {
    const sinPrecio = tier({ sku: 'SIN', precio: null });
    const res = calcularResumen({ SIN: 1 }, [sinPrecio]);
    expect(res.hasNullPrice).toBe(true);
    expect(res.total).toBeNull();
  });

  it('ignora cantidades 0/negativas y skus desconocidos', () => {
    const res = calcularResumen({ GEN: 0, VIP: -1, FANTASMA: 2 }, [GEN, VIP]);
    expect(res.combinaciones).toBe(0);
    expect(res.total).toBe(0);
  });

  it('devuelve total 0 con selección vacía', () => {
    const res = calcularResumen({}, [GEN, VIP]);
    expect(res.total).toBe(0);
    expect(res.combinaciones).toBe(0);
  });
});

describe('totalCombinaciones', () => {
  it('cuenta tiers de un día + pases combinados sin duplicar los multi-día', () => {
    const grupos = agruparTiers([DIA_1, DIA_2], [GEN, VIP]);
    // Antes del fix este número inflaba: GEN se contaba en d1 y en d2.
    expect(totalCombinaciones(grupos)).toBe(2); // VIP (d2) + GEN (pase)
  });

  it('es 0 cuando no hay tiers', () => {
    expect(totalCombinaciones(agruparTiers([DIA_1], []))).toBe(0);
  });
});
