import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { login, makeOrderPayload } from './helpers.js';
import { expectSchema } from './schema.js';
import { adminOrdersSchema } from './schemas/order.schema.js';

describe('GET /admin/orders — variant 10', () => {
  it('returns every user’s order to an administrator', async () => {
    const app = createApp();
    const alice = await login(app, 'alice@example.com');
    const bob = await login(app, 'bob@example.com');
    const admin = await login(app, 'admin@example.com', 'Admin123');

    const aliceOrder = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${alice}`)
      .send(makeOrderPayload());
    const bobOrder = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${bob}`)
      .send(makeOrderPayload());

    const response = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${admin}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expectSchema(response.body, adminOrdersSchema);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((order: { id: string }) => order.id).sort()).toEqual(
      [aliceOrder.body.id, bobOrder.body.id].sort(),
    );
  });

  it('returns 403 to a regular authenticated user', async () => {
    const app = createApp();
    const user = await login(app, 'bob@example.com');

    const response = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${user}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: 'FORBIDDEN' });
  });

  it('returns 401 without a valid token', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/admin/orders')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
  });
});
