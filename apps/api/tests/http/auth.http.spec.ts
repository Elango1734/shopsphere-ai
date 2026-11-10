import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';

const app = createApp();

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('POST /api/v1/auth/register', () => {
  it('registers a customer-only account even if a role field is injected in the request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'hacker@example.com', password: 'Sup3rSecret!!', roles: ['administrator'], role: 'administrator' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.roles).toEqual(['customer']);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'Sup3rSecret!!' });
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'Sup3rSecret!!' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects a weak password with a structured 400 validation error', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('rejects an incorrect password without revealing whether the account exists', async () => {
    await request(app).post('/api/v1/auth/register').send({ email: 'login@example.com', password: 'Sup3rSecret!!' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'login@example.com', password: 'wrong' });
    expect(res.status).toBe(401);

    const resUnknown = await request(app).post('/api/v1/auth/login').send({ email: 'nope@example.com', password: 'wrong' });
    expect(resUnknown.status).toBe(401);
    expect(resUnknown.body.error.message).toBe(res.body.error.message);
  });
});

describe('Refresh token rotation and reuse detection', () => {
  it('rotates the refresh token on each use and detects reuse of a stale token', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'rotate@example.com', password: 'Sup3rSecret!!' });
    const firstRefreshToken = registerRes.body.data.refreshToken as string;

    const firstRotate = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstRefreshToken });
    expect(firstRotate.status).toBe(200);
    const secondRefreshToken = firstRotate.body.data.refreshToken as string;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // Replaying the now-rotated-away first token must fail — it was single-use.
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstRefreshToken });
    expect(reuse.status).toBe(401);

    // Reuse detection revokes every session for the user, so even the valid second token is now dead.
    const secondRotateAfterReuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: secondRefreshToken });
    expect(secondRotateAfterReuse.status).toBe(401);
  });
});

describe('Protected routes require authentication', () => {
  it('rejects GET /api/v1/me without a bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('allows GET /api/v1/me with a valid bearer token', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({ email: 'me@example.com', password: 'Sup3rSecret!!' });
    const token = registerRes.body.data.accessToken as string;
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@example.com');
  });
});
