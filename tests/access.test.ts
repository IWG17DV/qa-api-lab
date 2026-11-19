import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { login, makeOrderPayload } from './helpers.js';

describe('Authentication and authorization', () => {
  it.each([
    { name: 'without a token', authorization: undefined },
    { name: 'with a forged token', authorization: 'Bearer invalid-token' },
    { name: 'without the Bearer scheme', authorization: 'some-token' },
  ])('rejects GET /orders $name', async ({ authorization }) => {
    const app = createApp();
    const req = request(app).get('/orders');
    if (authorization) req.set('Authorization', authorization);

    const response = await req;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
  });

  it('hides another user’s order as not found', async () => {
    const app = createApp();
    const alice = await login(app, 'alice@example.com');
    const bob = await login(app, 'bob@example.com');
    const created = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${alice}`)
      .send(makeOrderPayload());

    const response = await request(app)
      .get(`/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${bob}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND' });
  });
});
