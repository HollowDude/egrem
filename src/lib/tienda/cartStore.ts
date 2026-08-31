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
// Magnitudes por tienda: variationUuid -> (storeId -> cantidad).
let cacheByStore: Map<string, Map<string, number>> | null = null;
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
    const byStore = new Map<string, Map<string, number>>();
    // El carrito real de Drupal solo trae `sku` por línea (sin `variationUuid`), así que
    // indexamos por `sku` (y también por `variationUuid` cuando exista, p. ej. mock).
    const indexar = (key: string | null | undefined, cant: number, sid?: string | null) => {
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + cant);
      if (sid) {
        if (!byStore.has(key)) byStore.set(key, new Map());
        const m = byStore.get(key)!;
        m.set(sid, (m.get(sid) ?? 0) + cant);
      }
    };
    for (const o of cart?.orders ?? []) {
      const sid = o.storeId;
      for (const l of o.items) {
        indexar(l.sku, l.quantity, sid);
        indexar(l.variationUuid, l.quantity, sid);
      }
    }
    cache = map;
    cacheByStore = byStore;
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

export function getCartQty(variationUuid?: string | null): number {
  if (!variationUuid) return 0;
  return cache?.get(variationUuid) ?? 0;
}

/** Cantidad de una variación que ya está en el carrito para una tienda concreta. */
export function getCartQtyForStore(variationUuid?: string | null, storeId?: string | null): number {
  if (!variationUuid || !storeId) return 0;
  return cacheByStore?.get(variationUuid)?.get(storeId) ?? 0;
}

export function subscribeCartQty(fn: Listener): () => void {
  listeners.add(fn);
  ensureWired();
  if (!cache) void refetch();
  return () => {
    listeners.delete(fn);
  };
}
