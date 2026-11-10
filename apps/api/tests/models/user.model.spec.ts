import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { UserModel } from '../../src/models/user.model.js';
import { registerCustomerAccount, verifyPassword } from '../../src/repositories/user.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('User schema validation', () => {
  it('requires either email or phone', async () => {
    const user = new UserModel({ passwordHash: 'x' });
    await expect(user.validate()).rejects.toThrow();
  });

  it('enforces a unique email (case-insensitive via lowercase normalization)', async () => {
    await UserModel.create({ email: 'Dup@Example.com', passwordHash: 'x' });
    await expect(UserModel.create({ email: 'dup@example.com', passwordHash: 'y' })).rejects.toMatchObject({
      code: 11000
    });
  });

  it('defaults roles to customer only', async () => {
    const user = await UserModel.create({ email: 'default@example.com', passwordHash: 'x' });
    expect(user.roles).toEqual(['customer']);
  });
});

describe('registerCustomerAccount', () => {
  it('always assigns only the customer role regardless of client-supplied roles', async () => {
    // Even though the input type doesn't expose a `roles` field, this test documents and locks in the
    // security.md requirement: public registration must never create an administrator.
    const user = await registerCustomerAccount({ email: 'public@example.com', plainPassword: 'Sup3rSecret!!' });
    expect(user.roles).toEqual(['customer']);
    expect(user.status).toBe('pending_verification');
  });

  it('hashes the password with argon2id, never storing plaintext', async () => {
    const user = await registerCustomerAccount({ email: 'secure@example.com', plainPassword: 'Sup3rSecret!!' });
    const persisted = await UserModel.findById(user._id).select('+passwordHash');
    expect(persisted!.passwordHash).not.toBe('Sup3rSecret!!');
    expect(persisted!.passwordHash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(persisted!.passwordHash, 'Sup3rSecret!!')).resolves.toBe(true);
    await expect(verifyPassword(persisted!.passwordHash, 'wrong')).resolves.toBe(false);
  });
});
