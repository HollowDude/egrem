import { describe, it, expect } from 'vitest';
import {
  construirGrillaMes,
  solapaConMes,
  solapaDia,
  posicionEnSemana,
  mesSiguiente,
  mesAnterior,
} from '../calendario';

describe('construirGrillaMes', () => {
  it('builds a 42-cell grid starting on Sunday', () => {
    const grilla = construirGrillaMes(2026, 10);
    expect(grilla).toHaveLength(42);
    // Octubre 2026 empieza en jueves → los 4 primeros días son de septiembre.
    expect(grilla[0].fecha).toBe('2026-09-27');
    expect(grilla[0].esDelMes).toBe(false);
    expect(grilla[4].fecha).toBe('2026-10-01');
    expect(grilla[4].esDelMes).toBe(true);
  });

  it('handles months starting on Sunday', () => {
    const grilla = construirGrillaMes(2026, 11);
    expect(grilla[0].fecha).toBe('2026-11-01');
    expect(grilla[0].esDelMes).toBe(true);
  });

  it('february in a leap year', () => {
    const grilla = construirGrillaMes(2024, 2);
    expect(grilla.some((c) => c.fecha === '2024-02-29')).toBe(true);
  });
});

describe('solapaConMes', () => {
  it('matches events inside the month', () => {
    expect(solapaConMes('2026-10-14', '2026-10-16', 2026, 10)).toBe(true);
  });
  it('matches events that start before and end inside the month', () => {
    expect(solapaConMes('2026-09-28', '2026-10-02', 2026, 10)).toBe(true);
  });
  it('matches events that start inside and end after the month', () => {
    expect(solapaConMes('2026-10-30', '2026-11-03', 2026, 10)).toBe(true);
  });
  it('rejects events fully outside the month', () => {
    expect(solapaConMes('2026-11-05', '2026-11-08', 2026, 10)).toBe(false);
    expect(solapaConMes('2026-09-01', '2026-09-05', 2026, 10)).toBe(false);
  });
  it('rejects empty dates', () => {
    expect(solapaConMes('', '', 2026, 10)).toBe(false);
  });
});

describe('solapaDia', () => {
  it('covers single and multi-day events', () => {
    expect(solapaDia('2026-10-14', '2026-10-16', '2026-10-14')).toBe(true);
    expect(solapaDia('2026-10-14', '2026-10-16', '2026-10-15')).toBe(true);
    expect(solapaDia('2026-10-14', '2026-10-16', '2026-10-17')).toBe(false);
  });
});

describe('posicionEnSemana', () => {
  const anio = 2026;
  const mes = 10;

  it('computes column and span within a week', () => {
    // Oct 2026: semana 1 (índice 1) va del 4 al 10; el evento 7-9 ocupa 3 columnas.
    const pos = posicionEnSemana('2026-10-07', '2026-10-09', anio, mes, 1);
    expect(pos).toEqual({ columna: 4, span: 3 });
  });

  it('returns null when the event does not touch the week', () => {
    const pos = posicionEnSemana('2026-10-20', '2026-10-22', anio, mes, 0);
    expect(pos).toBeNull();
  });

  it('clips spans at week boundaries', () => {
    // Evento 12-18: la semana 2 (índice 2, días 11-17) solo cubre 12..17.
    const pos = posicionEnSemana('2026-10-12', '2026-10-18', anio, mes, 2);
    expect(pos).toEqual({ columna: 2, span: 6 });
  });
});

describe('mesSiguiente / mesAnterior', () => {
  it('wraps across year boundaries', () => {
    expect(mesSiguiente(2026, 12)).toEqual({ anio: 2027, mes: 1 });
    expect(mesAnterior(2026, 1)).toEqual({ anio: 2025, mes: 12 });
    expect(mesSiguiente(2026, 10)).toEqual({ anio: 2026, mes: 11 });
  });
});
