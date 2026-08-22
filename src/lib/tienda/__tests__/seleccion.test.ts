import { describe, it, expect } from 'vitest';
import {
  tiersPorDia,
  calcularResumen,
  combinacionesPosibles,
  type DiaSeleccion,
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

const GEN: NhEventoTipoEntrada = {
  nombre: 'General',
  sku: 'GEN',
  precio: 25,
  descripcion: '',
  capacidad: null,
  disponibles: null,
  destacado: false,
  diasIds: ['d1', 'd2'],
  zonaIds: ['z1', 'z2'],
};

const VIP: NhEventoTipoEntrada = {
  nombre: 'VIP',
  sku: 'VIP',
  precio: 80,
  descripcion: '',
  capacidad: null,
  disponibles: null,
  destacado: false,
  diasIds: ['d2'],
  zonaIds: ['z2'],
};

describe('tiersPorDia', () => {
  it('cruza programa × tiposEntrada por diasIds', () => {
    const ops = tiersPorDia([DIA_1, DIA_2], [GEN, VIP]);
    expect(ops[0].dia.id).toBe('d1');
    expect(ops[0].tiers.map((t) => t.sku)).toEqual(['GEN']);
    expect(ops[1].dia.id).toBe('d2');
    expect(ops[1].tiers.map((t) => t.sku).sort()).toEqual(['GEN', 'VIP']);
  });

  it('deja tiers vacíos para días sin entrada asociada', () => {
    const soloDia2 = tiersPorDia([DIA_2], [VIP]);
    expect(soloDia2[0].tiers).toHaveLength(1);
    const diaSinTier = tiersPorDia([DIA_1], [VIP]);
    expect(diaSinTier[0].tiers).toHaveLength(0);
  });
});

describe('calcularResumen', () => {
  it('suma total con varios días y cantidades distintas', () => {
    const seleccion: DiaSeleccion[] = [
      { diaId: 'd1', tipoEntradaSku: 'GEN', cantidad: 2 },
      { diaId: 'd2', tipoEntradaSku: 'GEN', cantidad: 1 },
      { diaId: 'd2', tipoEntradaSku: 'VIP', cantidad: 1 },
    ];
    const res = calcularResumen(seleccion, [GEN, VIP]);
    // GEN 2+1 = 3 × 25 = 75 ; VIP 1 × 80 = 80 → 155
    expect(res.total).toBe(155);
    expect(res.hasNullPrice).toBe(false);
    expect(res.combinaciones).toBe(3);
  });

  it('agrupa el mismo SKU elegido en varios días', () => {
    const seleccion: DiaSeleccion[] = [
      { diaId: 'd1', tipoEntradaSku: 'GEN', cantidad: 2 },
      { diaId: 'd2', tipoEntradaSku: 'GEN', cantidad: 3 },
    ];
    const res = calcularResumen(seleccion, [GEN, VIP]);
    expect(res.lineas).toHaveLength(1);
    expect(res.lineas[0].cantidad).toBe(5);
    expect(res.lineas[0].subtotal).toBe(125);
  });

  it('marca hasNullPrice cuando un tier tiene precio null (Consultar)', () => {
    const sinPrecio: NhEventoTipoEntrada = { ...GEN, sku: 'SIN', precio: null };
    const seleccion: DiaSeleccion[] = [{ diaId: 'd1', tipoEntradaSku: 'SIN', cantidad: 1 }];
    const res = calcularResumen(seleccion, [sinPrecio]);
    expect(res.hasNullPrice).toBe(true);
    expect(res.total).toBeNull();
  });

  it('ignora selecciones sin sku o cantidad 0', () => {
    const seleccion: DiaSeleccion[] = [
      { diaId: 'd1', tipoEntradaSku: null, cantidad: 2 },
      { diaId: 'd2', tipoEntradaSku: 'GEN', cantidad: 0 },
    ];
    const res = calcularResumen(seleccion, [GEN, VIP]);
    expect(res.combinaciones).toBe(0);
    expect(res.total).toBe(0);
  });
});

describe('combinacionesPosibles', () => {
  it('cuenta días × tiers activos', () => {
    const ops = tiersPorDia([DIA_1, DIA_2], [GEN, VIP]);
    expect(combinacionesPosibles(ops)).toBe(3); // d1:1, d2:2
  });

  it('es 0 cuando no hay tiers', () => {
    expect(combinacionesPosibles([{ dia: DIA_1, tiers: [] }])).toBe(0);
  });
});
