import { describe, it, expect, beforeEach } from 'vitest';
import {
  addToCart,
  getCart,
  removeCartStore,
  updateCartItem,
  removeCartItem,
} from '../carrito';

let auth: { accessToken: string };
beforeEach(() => {
  auth = { accessToken: 'test-user-' + Math.random().toString(36).slice(2) };
});

const linea = (over: Partial<{ sku: string; variationUuid: string; title: string; precioUnitario: number; quantity: number; storeId: string }>) => ({
  bundle: 'libro' as const,
  sku: 'S1',
  variationUuid: 'v1',
  title: 'L1',
  precioUnitario: 10,
  quantity: 1,
  storeId: '2',
  ...over,
});

describe('carrito mock (agrupado por tienda)', () => {
  it('agrupa líneas por tienda en orders[] con subtotal y count correctos', async () => {
    await addToCart([linea({ sku: 'S1', variationUuid: 'v1', precioUnitario: 10, quantity: 1, storeId: '2' })], auth);
    await addToCart([linea({ sku: 'S2', variationUuid: 'v2', title: 'L2', precioUnitario: 5, quantity: 2, storeId: '3' })], auth);

    const cart = await getCart(auth);
    expect(cart.orders).toHaveLength(2);
    expect(cart.count).toBe(3);
    expect(cart.subtotal).toBe(10 * 1 + 5 * 2);

    const egrem = cart.orders.find((o) => o.storeId === '2');
    expect(egrem?.storeLabel).toBe('Egrem');
    expect(egrem?.items[0].quantity).toBe(1);

    const tp = cart.orders.find((o) => o.storeId === '3');
    expect(tp?.storeLabel).toBe('Tienda prueba');
    expect(tp?.items[0].quantity).toBe(2);
  });

  it('acumula cantidad al re-añadir la misma variación en la misma tienda', async () => {
    await addToCart([linea({ quantity: 1, storeId: '2' })], auth);
    await addToCart([linea({ quantity: 2, storeId: '2' })], auth);

    const cart = await getCart(auth);
    const egrem = cart.orders.find((o) => o.storeId === '2');
    expect(egrem?.items).toHaveLength(1);
    expect(egrem?.items[0].quantity).toBe(3);
  });

  it('separa la misma variación en distintas tiendas en dos pedidos', async () => {
    await addToCart([linea({ quantity: 1, storeId: '2' })], auth);
    await addToCart([linea({ quantity: 1, storeId: '3' })], auth);

    const cart = await getCart(auth);
    expect(cart.orders).toHaveLength(2);
    expect(cart.count).toBe(2);
  });

  it('removeCartStore vacía el pedido de esa tienda (stopgap §1.4)', async () => {
    await addToCart([linea({ storeId: '2' })], auth);
    await addToCart([linea({ sku: 'S2', variationUuid: 'v2', storeId: '3' })], auth);

    const cart = await getCart(auth);
    const orderId = cart.orders.find((o) => o.storeId === '2')!.orderId;
    const after = await removeCartStore(orderId, auth);

    expect(after.orders.find((o) => o.storeId === '2')).toBeUndefined();
    expect(after.orders.find((o) => o.storeId === '3')).toBeDefined();
    expect(after.count).toBe(1);
  });

  it('updateCartItem y removeCartItem operan por itemId en mock', async () => {
    await addToCart([linea({ storeId: '2' })], auth);
    let cart = await getCart(auth);
    const itemId = cart.orders[0].items[0].itemId!;
    expect(itemId).toBeTruthy();

    cart = await updateCartItem(itemId, 4, auth);
    expect(cart.orders[0].items[0].quantity).toBe(4);

    cart = await removeCartItem(itemId, auth);
    expect(cart.orders).toHaveLength(0);
  });
});
