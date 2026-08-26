import { describe, it, expect } from 'vitest';
import { parseCartResponse } from '../carrito';

const BASE = 'http://127.0.0.1:57454';

// Documento realista tal cual lo devuelve Drupal Commerce JSON:API
// GET /{lang}/jsonapi/commerce_order/default?filter[cart]=1&include=order_items,...
const cartDoc = {
  data: [
    {
      type: 'commerce_order--default',
      id: 'ord-1',
      attributes: { order_number: '22', total_price: { number: '20.00', currency_code: 'USD' } },
      relationships: {
        order_items: { data: [{ type: 'order_item--default', id: 'oi-1' }] },
      },
    },
  ],
  included: [
    {
      type: 'order_item--default',
      id: 'oi-1',
      attributes: {
        title: 'Camiseta EGREM',
        quantity: 2,
        unit_price: { number: '10.00', currency_code: 'USD' },
      },
      relationships: {
        purchased_entity: { data: { type: 'commerce_product_variation--prenda', id: 'v-1' } },
      },
    },
    {
      type: 'commerce_product_variation--prenda',
      id: 'v-1',
      attributes: {
        sku: 'EGR-001',
        title: 'Camiseta EGREM - M / Rojo',
        drupal_internal__variation_id: 109,
        attribute_talla: 'M',
        attribute_color: 'Rojo',
        field_imagen: { uri: { url: '/sites/default/files/camiseta.jpg' } },
      },
      relationships: {
        attribute_talla: { data: { type: 'taxonomy_term--talla', id: 't-1' } },
        attribute_color: { data: { type: 'taxonomy_term--color', id: 'c-1' } },
        field_imagen: { data: { type: 'file--file', id: 'f-1' } },
      },
    },
    { type: 'taxonomy_term--talla', id: 't-1', attributes: { name: 'M' } },
    { type: 'taxonomy_term--color', id: 'c-1', attributes: { name: 'Rojo' } },
    {
      type: 'file--file',
      id: 'f-1',
      attributes: { uri: { url: 'http://127.0.0.1:57454/sites/default/files/camiseta.jpg' } },
    },
  ],
};

describe('parseCartResponse', () => {
  it('extrae lineas desde {data, included} (caso real de Drupal)', () => {
    const cart = parseCartResponse(cartDoc, BASE);
    expect(cart.lines).toHaveLength(1);
    expect(cart.count).toBe(2);
    expect(cart.subtotal).toBe(20);
    expect(cart.orderId).toBe('ord-1');
    const line = cart.lines[0];
    expect(line.orderItemId).toBe('oi-1');
    expect(line.variationId).toBe(109);
    expect(line.variationUuid).toBe('v-1');
    expect(line.sku).toBe('EGR-001');
    expect(line.title).toBe('Camiseta EGREM');
    expect(line.talla).toBe('M');
    expect(line.color).toBe('Rojo');
    expect(line.cantidad).toBe(2);
    expect(line.precioUnitario).toBe(10);
    expect(line.imagen).toBe('http://127.0.0.1:57454/sites/default/files/camiseta.jpg');
  });

  it('devuelve carrito vacio cuando data es []', () => {
    const cart = parseCartResponse({ data: [], included: [] }, BASE);
    expect(cart.lines).toHaveLength(0);
    expect(cart.count).toBe(0);
    expect(cart.orderId).toBeNull();
  });

  it('no rompe si no hay included (usa variation embebida como fallback)', () => {
    const doc = {
      data: [
        {
          type: 'commerce_order--default',
          id: 'o',
          attributes: {},
          relationships: { order_items: { data: [{ type: 'order_item--default', id: 'oi' }] } },
        },
      ],
      included: [
        {
          type: 'order_item--default',
          id: 'oi',
          attributes: { title: 'X', quantity: 1, unit_price: { number: '5.00' } },
          relationships: {
            purchased_entity: {
              data: { type: 'commerce_product_variation--prenda', id: 'v' },
            },
          },
        },
        {
          type: 'commerce_product_variation--prenda',
          id: 'v',
          attributes: { sku: 'S', title: 'Var', drupal_internal__variation_id: 1 },
          relationships: {},
        },
      ],
    };
    const cart = parseCartResponse(doc, BASE);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].sku).toBe('S');
    expect(cart.lines[0].variationId).toBe(1);
  });
});
