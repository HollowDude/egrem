import type { Cart } from '@/lib/nodehive/carrito';

async function mutate(method: string, id: string, body?: unknown): Promise<Cart> {
  const res = await fetch(`/api/cart/items/${id}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('cart mutation failed');
  return (await res.json()) as Cart;
}

/** Fija la cantidad de una línea (usado por + / −). */
export async function setCantidad(id: string, quantity: number): Promise<Cart> {
  return mutate('PATCH', id, { quantity });
}

/** Incrementa (o decrementa) la cantidad de una línea vía add-to-cart.
 *  El backend valida stock y responde 409 `stock_insufficient` si se excede. */
export async function incrementarLinea(
  sku: string,
  storeId: string,
   quantity = 1,
): Promise<void> {
  if (!storeId) {
    throw new Error('STORE_REQUIRED');
  }
  const res = await fetch('/api/cart/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku, storeId, quantity }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string; disponible?: number } | null;
    if (data?.message === 'stock_insufficient') {
      const err = new Error('STOCK_INSUFFICIENT') as Error & { disponible?: number };
      err.disponible = data.disponible;
      throw err;
    }
    throw new Error('incrementar falló');
  }
}

/** Elimina una línea del carrito (por `item_id`; requiere backend §1.4). */
export async function quitar(id: string): Promise<Cart> {
  return mutate('DELETE', id);
}

/** Stopgap (plan §1.4): vacía el pedido completo de una tienda por `order_id`. */
export async function vaciarPedido(orderId: number): Promise<Cart> {
  const res = await fetch(`/api/cart/store/${orderId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('vaciar pedido falló');
  return (await res.json()) as Cart;
}
