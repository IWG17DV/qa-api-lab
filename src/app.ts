import { randomUUID } from 'node:crypto';
import express, { type Request, type RequestHandler, type Response } from 'express';

type Tier = 'basic' | 'silver' | 'gold';
type Role = 'user' | 'admin';

interface User {
  id: string;
  email: string;
  password: string;
  tier: Tier;
  role: Role;
}

interface Item {
  sku: string;
  price: number;
  qty: number;
}

interface Order {
  id: string;
  ownerId: string;
  tier: Tier;
  items: Item[];
  subtotal: number;
  total: number;
  createdAt: string;
}

type AuthenticatedHandler = (req: Request, res: Response, user: User) => void;

const USERS: User[] = [
  { id: 'u1', email: 'alice@example.com', password: 'Secret123', tier: 'gold', role: 'user' },
  { id: 'u2', email: 'bob@example.com', password: 'Secret123', tier: 'basic', role: 'user' },
  { id: 'u3', email: 'admin@example.com', password: 'Admin123', tier: 'basic', role: 'admin' },
];

const DISCOUNT: Record<Tier, number> = { basic: 0, silver: 0.05, gold: 0.1 };
const round2 = (value: number) => Math.round(value * 100) / 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPublic({ ownerId: _ownerId, ...order }: Order): Omit<Order, 'ownerId'> {
  return order;
}

export function createApp() {
  const app = express();
  app.use(express.json());

  const tokens = new Map<string, string>();
  const orders = new Map<string, Order>();
  const withUser = (handler: AuthenticatedHandler): RequestHandler => (req, res) => {
    const authorization = req.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    const userId = match ? tokens.get(match[1]) : undefined;
    const user = USERS.find((candidate) => candidate.id === userId);

    if (!user) {
      res.status(401).json({ code: 'UNAUTHORIZED' });
      return;
    }

    handler(req, res, user);
  };
  const withAdmin = (handler: AuthenticatedHandler): RequestHandler =>
    withUser((req, res, user) => {
      if (user.role !== 'admin') {
        res.status(403).json({ code: 'FORBIDDEN' });
        return;
      }
      handler(req, res, user);
    });

  app.post('/auth/login', (req, res) => {
    const body: unknown = req.body;
    const credentials = isRecord(body) ? body : {};
    const user = USERS.find(
      (candidate) =>
        candidate.email === credentials.email && candidate.password === credentials.password,
    );

    if (!user) {
      res.status(401).json({ code: 'INVALID_CREDENTIALS' });
      return;
    }

    const token = randomUUID();
    tokens.set(token, user.id);
    res.json({ accessToken: token });
  });

  app.post('/orders', withUser((req, res, user) => {
    const body: unknown = req.body;
    const rawItems = isRecord(body) ? body.items : undefined;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ code: 'EMPTY_ORDER' });
      return;
    }

    const items: Item[] = [];
    for (const candidate of rawItems) {
      if (!isRecord(candidate) || typeof candidate.sku !== 'string') {
        res.status(400).json({ code: 'INVALID_SKU' });
        return;
      }
      if (typeof candidate.price !== 'number' || candidate.price < 0) {
        res.status(400).json({ code: 'INVALID_PRICE' });
        return;
      }
      if (typeof candidate.qty !== 'number' || !Number.isInteger(candidate.qty) || candidate.qty <= 0) {
        res.status(400).json({ code: 'INVALID_QTY' });
        return;
      }

      items.push({ sku: candidate.sku, price: candidate.price, qty: candidate.qty });
    }

    const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.qty, 0));
    let rate = DISCOUNT[user.tier];
    if (subtotal >= 2000) rate += 0.05;
    const afterDiscount = round2(subtotal * (1 - Math.min(rate, 0.25)));
    const total = round2(afterDiscount + (afterDiscount >= 1000 ? 0 : 60));
    const order: Order = {
      id: randomUUID(),
      ownerId: user.id,
      tier: user.tier,
      items,
      subtotal,
      total,
      createdAt: new Date().toISOString(),
    };

    orders.set(order.id, order);
    res.status(201).location(`/orders/${order.id}`).json(toPublic(order));
  }));

  app.get('/orders', withUser((_req, res, user) => {
    const mine = [...orders.values()].filter((order) => order.ownerId === user.id);
    res.json(mine.map(toPublic));
  }));

  app.get('/orders/:id', withUser((req, res, user) => {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    const order = orders.get(id);
    if (!order || order.ownerId !== user.id) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    res.json(toPublic(order));
  }));

  app.delete('/orders/:id', withUser((req, res, user) => {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    const order = orders.get(id);
    if (!order || order.ownerId !== user.id) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    orders.delete(order.id);
    res.status(204).end();
  }));

  app.get('/admin/orders', withAdmin((_req, res) => {
    res.json([...orders.values()].map(toPublic));
  }));

  return app;
}
