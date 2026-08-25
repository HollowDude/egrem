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

/** Elimina una línea del carrito. */
export async function quitar(id: string): Promise<Cart> {
  return mutate('DELETE', id);
}
