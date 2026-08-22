import type { NhEventoDetalle } from '@/lib/nodehive';
import { tiersPorDia, combinacionesPosibles } from './seleccion';

export type CtaCompra =
  | { tipo: 'checkout_directo'; sku: string; diaId: string; href: string }
  | { tipo: 'ver_tienda'; href: string };

/**
 * Decide el destino del CTA principal del detalle de evento:
 * - Si hay EXACTAMENTE una combinación posible (1 día × 1 tier) y el evento
 *   no ha pasado → compra directa al checkout.
 * - En cualquier otro caso (varios días/tiers, o evento pasado) → la ficha de
 *   tienda, donde el usuario elige días y cantidad.
 *
 * El href de `checkout_directo` apunta a la ruta que se implementa en la Fase 6.
 */
export function resolveCtaCompra(
  evento: NhEventoDetalle,
  lang = 'es',
  esPasado = false,
): CtaCompra {
  // Un evento pasado nunca deriva a compra directa.
  if (esPasado) {
    const tiendaHref = evento.href.replace(/\/evento\//, '/tienda/entrada/');
    return { tipo: 'ver_tienda', href: `${tiendaHref}?lang=${lang}` };
  }

  const opciones = tiersPorDia(evento.programa, evento.tiposEntrada);
  const posibles = combinacionesPosibles(opciones);

  if (posibles === 1 && evento.tiposEntrada.length > 0) {
    const unica = opciones.find((o) => o.tiers.length > 0);
    if (unica) {
      const tier = unica.tiers[0];
      const sku = tier.sku;
      const diaId = unica.dia.id;
      const href = `/checkout/entrada?sku=${encodeURIComponent(sku)}&dia=${encodeURIComponent(diaId)}&evento=${encodeURIComponent(evento.id)}&lang=${lang}`;
      return { tipo: 'checkout_directo', sku, diaId, href };
    }
  }

  const tiendaHref = evento.href.replace(/\/evento\//, '/tienda/entrada/');
  return { tipo: 'ver_tienda', href: `${tiendaHref}?lang=${lang}` };
}
