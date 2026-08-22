import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive/eventos';

/**
 * Lógica pura de selección de entradas por día del evento.
 * No depende de React ni del DOM: se testea directamente (ver seleccion.test.ts).
 */

export interface DiaSeleccion {
  diaId: string;
  tipoEntradaSku: string | null;
  cantidad: number;
}

export interface DiaOpcion {
  dia: NhEventoProgramaDia;
  /** Tiers (tipos de entrada) que dan acceso a este día. */
  tiers: NhEventoTipoEntrada[];
}

export interface LineaResumen {
  sku: string;
  nombre: string;
  precioUnitario: number | null;
  cantidad: number;
  subtotal: number | null;
}

export interface ResumenSeleccion {
  lineas: LineaResumen[];
  total: number | null;
  hasNullPrice: boolean;
  combinaciones: number;
}

/** Cruza programa × tiposEntrada: para cada día, qué tiers lo incluyen. */
export function tiersPorDia(
  programa: NhEventoProgramaDia[],
  tiposEntrada: NhEventoTipoEntrada[],
): DiaOpcion[] {
  return programa.map((dia) => ({
    dia,
    tiers: tiposEntrada.filter((t) => t.diasIds.includes(dia.id)),
  }));
}

/**
 * Calcula el resumen (líneas, total, si hay precios nulos) a partir de una
 * selección por día. Agrupa por SKU (el mismo tier elegido en varios días
 * suma cantidades).
 */
export function calcularResumen(
  seleccion: DiaSeleccion[],
  tiposEntrada: NhEventoTipoEntrada[],
): ResumenSeleccion {
  const porSku = new Map(tiposEntrada.map((t) => [t.sku, t]));
  const lineasMap = new Map<string, LineaResumen>();

  for (const sel of seleccion) {
    if (!sel.tipoEntradaSku || sel.cantidad <= 0) continue;
    const t = porSku.get(sel.tipoEntradaSku);
    if (!t) continue;
    const existente = lineasMap.get(t.sku);
    if (existente) {
      existente.cantidad += sel.cantidad;
    } else {
      lineasMap.set(t.sku, {
        sku: t.sku,
        nombre: t.nombre,
        precioUnitario: t.precio,
        cantidad: sel.cantidad,
        subtotal: null,
      });
    }
  }

  const lineas = [...lineasMap.values()].map((l) => ({
    ...l,
    subtotal: l.precioUnitario !== null ? l.precioUnitario * l.cantidad : null,
  }));

  const hasNullPrice = lineas.some((l) => l.precioUnitario === null);
  const total = hasNullPrice ? null : lineas.reduce((acc, l) => acc + (l.subtotal ?? 0), 0);
  const combinaciones = seleccion.filter((s) => s.tipoEntradaSku && s.cantidad > 0).length;

  return { lineas, total, hasNullPrice, combinaciones };
}

/** Número de combinaciones posibles (días × tiers activos) para decidir CTA. */
export function combinacionesPosibles(opciones: DiaOpcion[]): number {
  return opciones.reduce((acc, o) => acc + o.tiers.length, 0);
}
