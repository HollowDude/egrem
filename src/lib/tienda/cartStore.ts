import type { Cart } from '@/lib/nodehive/carrito';

/**
 * Store ligero del carrito, solo para la UI de las tarjetas de producto.
 * Mantiene un mapa `variationUuid → cantidad total en el carrito` y se
 * actualiza ante cualquier evento `cart:*` (añadir, modificar, quitar).
 *
 * Permite deshabilitar el botón "agregar" de una tarjeta cuando el carrito
 * ya contiene todo el stock disponible, sin necesidad de refetch por tarjeta.
 */

type Listener = () => void;

let cache: Map<string, number> | null = null;
let loading = false;
const listeners = new Set<Listener>();
let wired = false;

async function refetch(): Promise<void> {
  if (loading) return;
  loading = true;
  try {
    const res = await fetch('/api/cart');
    const cart: Cart | null = res.ok ? ((await res.json()) as Cart) : null;
    const map = new Map<string, number>();
    for (const l of cart?.lines ?? []) {
      if (l.variationUuid) {
        map.set(l.variationUuid, (map.get(l.variationUuid) ?? 0) + l.cantidad);
      }
    }
    cache = map;
    listeners.forEach((fn) => fn());
  } catch {
    /* sin conexión: dejamos el cache anterior */
  } finally {
    loading = false;
  }
}

function ensureWired(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('cart:updated', refetch);
  window.addEventListener('cart:added', refetch);
  window.addEventListener('cart:removed', refetch);
}

export function getCartQty(variationUuid?: string): number {
  if (!variationUuid) return 0;
  return cache?.get(variationUuid) ?? 0;
}

export function subscribeCartQty(fn: Listener): () => void {
  listeners.add(fn);
  ensureWired();
  if (!cache) void refetch();
  return () => {
    listeners.delete(fn);
  };
}
