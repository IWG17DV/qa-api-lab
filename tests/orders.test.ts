import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { login, makeOrderPayload } from './helpers.js';
import { expectSchema } from './schema.js';
import { orderSchema } from './schemas/order.schema.js';

describe('Orders API', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeEach(async () => {
    app = createApp();
    token = await login(app, 'bob@example.com');
  });

  it('creates an order and exposes its location and calculated values', async () => {
    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(makeOrderPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/orders/${response.body.id}`);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.subtotal).toBe(500);
    expect(response.body.total).toBe(560);
    expectSchema(response.body, orderSchema);

    const fetched = await request(app)
      .get(`/orders/${response.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(response.body);
    expectSchema(fetched.body, orderSchema);
  });

  it.each([
    { name: 'empty item list', code: 'EMPTY_ORDER', items: [] },
    { name: 'negative price', code: 'INVALID_PRICE', items: [{ sku: 'A', price: -1, qty: 1 }] },
    { name: 'zero quantity', code: 'INVALID_QTY', items: [{ sku: 'A', price: 10, qty: 0 }] },
    { name: 'fractional quantity', code: 'INVALID_QTY', items: [{ sku: 'A', price: 10, qty: 1.5 }] },
    { name: 'non-numeric price', code: 'INVALID_PRICE', items: [{ sku: 'A', price: '10', qty: 1 }] },
  ])('rejects $name with $code', async ({ code, items }) => {
    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code });
  });

  it('returns only the authenticated user’s orders', async () => {
    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(makeOrderPayload());
    const list = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toEqual(response.body);
  });

  it('deletes an order and leaves no resource behind', async () => {
    const created = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(makeOrderPayload());
    const url = `/orders/${created.body.id}`;

    const firstDelete = await request(app).delete(url).set('Authorization', `Bearer ${token}`);
    expect(firstDelete.status).toBe(204);
    expect(firstDelete.text).toBe('');

    const secondDelete = await request(app).delete(url).set('Authorization', `Bearer ${token}`);
    const fetched = await request(app).get(url).set('Authorization', `Bearer ${token}`);
    expect(secondDelete.status).toBe(404);
    expect(fetched.status).toBe(404);
  });
});
