import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive/eventos';

/**
 * Lógica pura de selección de entradas por día del evento.
 * No depende de React ni del DOM: se testea directamente (ver seleccion.test.ts).
 *
 * Principio: la selección vive por SKU (`Record<sku, cantidad>`). El día es solo
 * un criterio de agrupación visual. Un tier multi-día aparece UNA sola vez (en
 * `multiDia`), nunca dentro de las tarjetas de día individuales → es imposible
 * estructuralmente contar el mismo pase dos veces.
 */

export interface DiaOpcion {
  dia: NhEventoProgramaDia;
  /** Tiers que dan acceso EXCLUSIVAMENTE a este día (diasIds.length === 1). */
  tiers: NhEventoTipoEntrada[];
}

export interface TierMultiDia {
  tier: NhEventoTipoEntrada;
  /** Días reales que cubre el pase, resueltos contra el programa (no solo ids). */
  dias: NhEventoProgramaDia[];
}

export interface AgrupacionTiers {
  porDia: DiaOpcion[];
  multiDia: TierMultiDia[];
}

/** Selección de estado: sku → cantidad. Un sku = una entrada en el mapa. */
export type SeleccionPorSku = Record<string, number>;

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

/**
 * Agrupa programa × tiposEntrada:
 * - `porDia`: un grupo por día con SOLO sus tiers de un solo día.
 * - `multiDia`: pases combinados (diasIds.length > 1) con los días resueltos.
 */
export function agruparTiers(
  programa: NhEventoProgramaDia[],
  tiposEntrada: NhEventoTipoEntrada[],
): AgrupacionTiers {
  const porDiaMap = new Map(programa.map((d) => [d.id, d]));

  const tiersUnDia = tiposEntrada.filter((t) => t.diasIds.length === 1);
  const tiersMultiDia = tiposEntrada.filter((t) => t.diasIds.length > 1);

  const porDia = programa.map((dia) => ({
    dia,
    tiers: tiersUnDia.filter((t) => t.diasIds[0] === dia.id),
  }));

  const multiDia = tiersMultiDia.map((tier) => ({
    tier,
    dias: tier.diasIds
      .map((id) => porDiaMap.get(id))
      .filter((d): d is NhEventoProgramaDia => !!d),
  }));

  return { porDia, multiDia };
}

/**
 * Calcula el resumen (líneas, total, si hay precios nulos) a partir de la
 * selección por SKU. Cada SKU existe como mucho una vez en el Record, así que
 * no puede haber doble conteo por construcción.
 */
export function calcularResumen(
  seleccion: SeleccionPorSku,
  tiposEntrada: NhEventoTipoEntrada[],
): ResumenSeleccion {
  const porSku = new Map(tiposEntrada.map((t) => [t.sku, t]));
  const lineas: LineaResumen[] = [];

  for (const [sku, cantidad] of Object.entries(seleccion)) {
    if (!sku || cantidad <= 0) continue;
    const t = porSku.get(sku);
    if (!t) continue;
    lineas.push({
      sku: t.sku,
      nombre: t.nombre,
      precioUnitario: t.precio,
      cantidad,
      subtotal: t.precio !== null ? t.precio * cantidad : null,
    });
  }

  const hasNullPrice = lineas.some((l) => l.precioUnitario === null);
  const total = hasNullPrice ? null : lineas.reduce((acc, l) => acc + (l.subtotal ?? 0), 0);

  return { lineas, total, hasNullPrice, combinaciones: lineas.length };
}

/** Número total de opciones comprables (tiers de un día + pases combinados). */
export function totalCombinaciones(grupos: AgrupacionTiers): number {
  return grupos.porDia.reduce((acc, o) => acc + o.tiers.length, 0) + grupos.multiDia.length;
}
