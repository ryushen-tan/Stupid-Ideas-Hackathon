import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { URI } from 'otpauth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, '127.0.0.1', 'Integration tests only run against local Supabase.');
const configuration = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8' }));
const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, configuration.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `auth-test-${randomUUID()}@example.com`;
const password = randomUUID();
let userId;

async function checkAccess(expectedStatus) {
  const { data } = await client.auth.getSession();
  const headers = data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  const response = await fetch('http://localhost:3020/api/access', { headers });
  assert.equal(response.status, expectedStatus, await response.text());
}

try {
  await checkAccess(401);
  const { data: signup, error: signupError } = await client.auth.signUp({ email, password });
  assert.ifError(signupError);
  userId = signup.user.id;
  await checkAccess(403);
  const { data: factor, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Entre', friendlyName: 'Integration test' });
  assert.ifError(enrollError);
  assert.ok(factor.totp.qr_code.startsWith('data:image/svg+xml'));
  const authenticator = URI.parse(factor.totp.uri);
  const validCode = authenticator.generate();
  const invalidCode = String((Number(validCode) + 1) % 1000000).padStart(6, '0');
  const { error: invalidError } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: invalidCode });
  assert.ok(invalidError, 'An invalid authenticator code must be rejected.');
  await checkAccess(403);
  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: validCode });
  assert.ifError(verifyError);
  await checkAccess(200);
  const { error: signOutError } = await client.auth.signOut();
  assert.ifError(signOutError);
  await checkAccess(401);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);
  await checkAccess(403);
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  assert.ifError(factorsError);
  assert.equal(factors.totp[0].id, factor.id);
  const { error: returnVerifyError } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: authenticator.generate() });
  assert.ifError(returnVerifyError);
  await checkAccess(200);
  console.log('PASS: signup, QR enrollment, invalid code rejection, AAL2 access, sign-out, and returning-user 2FA.');
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}
