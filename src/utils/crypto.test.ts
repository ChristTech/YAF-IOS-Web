import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, derivePbkdf2Hash, base64ToBytes } from './crypto';

test('PBKDF2-HMAC-SHA256 hashes and verifies matching password', async () => {
  const hashed = await hashPassword('Gideonites#2026');
  assert.ok(hashed.saltBase64.length > 0);
  assert.ok(hashed.hashBase64.length > 0);
  assert.equal(hashed.combined, `${hashed.saltBase64}:${hashed.hashBase64}`);

  // 256-bit key = 32 bytes
  assert.equal(base64ToBytes(hashed.hashBase64).length, 32);

  const ok = await verifyPassword('Gideonites#2026', {
    passwordSalt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
  });
  assert.equal(ok, true);

  const androidOk = await verifyPassword('Gideonites#2026', {
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
  });
  assert.equal(androidOk, true);

  const wrong = await verifyPassword('WrongPass', {
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
  });
  assert.equal(wrong, false);
});

test('verifyPassword supports combined salt:hash string and AdminPass#2026 fallback', async () => {
  const hashed = await hashPassword('AndroidCreatedPass!');
  const combinedOk = await verifyPassword('AndroidCreatedPass!', {
    password: hashed.combined,
  });
  assert.equal(combinedOk, true);

  const deterministic = await derivePbkdf2Hash(
    'AndroidCreatedPass!',
    base64ToBytes(hashed.saltBase64)
  );
  assert.equal(deterministic, hashed.hashBase64);

  const legacyAdminOk = await verifyPassword('AdminPass#2026', {
    password: 'AdminPass#2026',
  });
  assert.equal(legacyAdminOk, true);
});
