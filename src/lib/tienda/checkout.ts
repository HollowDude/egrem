import type { NhEventoDetalle } from '@/lib/nodehive';
import { calcularResumen, type ResumenSeleccion, type SeleccionPorSku } from './seleccion';

export interface CheckoutItem {
  sku: string;
  cantidad: number;
}

export interface CheckoutPayload {
  eventoId?: string;
  /** Mapa sku → cantidad, idéntico al estado de selección de la Tienda. */
  items: CheckoutItem[];
}

export type ProcesarResult =
  | { ok: true; total: number | null; resumen: ResumenSeleccion }
  | { ok: false; status: 400 | 409; message: string };

/**
 * Valida y recalcula el pedido SERVER-SIDE a partir del evento revalidado
 * contra Drupal. Nunca confía en los precios/cantidades que manda el cliente.
 * Si no hay evento (Drupal caído o id ausente) devuelve ok:true sin total:
 * el stub de la API route sigue adelante sin revalidación.
 */
export function procesarCheckout(
  payload: CheckoutPayload,
  evento: NhEventoDetalle | null,
): ProcesarResult {
  if (!payload?.items?.length) {
    return { ok: false, status: 400, message: 'no_items' };
  }
  for (const it of payload.items) {
    if (!it.sku || !(it.cantidad > 0)) {
      return { ok: false, status: 400, message: 'item_invalido' };
    }
  }

  if (!evento) {
    return {
      ok: true,
      total: null,
      resumen: {
        lineas: [],
        total: null,
        hasNullPrice: false,
        combinaciones: payload.items.length,
      },
    };
  }

  for (const it of payload.items) {
    const t = evento.tiposEntrada.find((x) => x.sku === it.sku);
    if (!t) return { ok: false, status: 409, message: 'sku_invalido' };
    if (t.disponibles === 0) return { ok: false, status: 409, message: 'agotado' };
  }

  // Mismo mapa sku→cantidad que maneja la UI; si un sku viniera repetido se
  // suma defensivamente, nunca se pisa.
  const seleccion: SeleccionPorSku = {};
  for (const it of payload.items) {
    seleccion[it.sku] = (seleccion[it.sku] ?? 0) + it.cantidad;
  }
  const resumen = calcularResumen(seleccion, evento.tiposEntrada);
  return { ok: true, total: resumen.total, resumen };
}

export interface SolicitarCheckoutResult {
  checkoutUrl: string;
}

/** Llama a la API route server-side de checkout (usa el stub o el real). */
export async function solicitarCheckout(
  payload: CheckoutPayload,
): Promise<SolicitarCheckoutResult> {
  const res = await fetch('/api/checkout/entrada', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? 'checkout_failed');
  }
  return res.json() as Promise<SolicitarCheckoutResult>;
}
