import { describe, expect, it } from 'vitest';
import { expectSchema } from './schema.js';
import { orderSchema } from './schemas/order.schema.js';

describe('Order response schema', () => {
  it('detects an ownerId leak as an unexpected property', () => {
    const leakedOrder = {
      id: 'order-1',
      tier: 'basic',
      subtotal: 500,
      total: 560,
      createdAt: '2026-11-19T12:00:00.000Z',
      items: [{ sku: 'SKU-A', price: 500, qty: 1 }],
      ownerId: 'u2',
    };

    expect(() => expectSchema(leakedOrder, orderSchema)).toThrow();
  });
});
