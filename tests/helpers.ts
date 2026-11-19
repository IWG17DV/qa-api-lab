import request from 'supertest';
import type { Express } from 'express';

export async function login(
  app: Express,
  email: string,
  password = 'Secret123',
): Promise<string> {
  const response = await request(app)
    .post('/auth/login')
    .send({ email, password });

  if (response.status !== 200 || typeof response.body.accessToken !== 'string') {
    throw new Error(`login failed: ${response.status}`);
  }

  return response.body.accessToken;
}

export function makeOrderPayload(overrides: { items?: unknown } = {}) {
  return { items: [{ sku: 'SKU-A', price: 500, qty: 1 }], ...overrides };
}
