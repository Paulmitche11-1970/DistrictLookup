import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewToken, validReviewToken } from '../lib/review-token';
void test('Review sessions reject cross-scope use, tampering, expiry and password rotation', () => {
  process.env.APP_SECRET = 'review-test-secret-'.repeat(4);
  process.env.RP_REVIEW_PASSWORD_HASH = 'test-rp-hash';
  process.env.MARTINEZ_REVIEW_PASSWORD_HASH = 'test-agency-hash';
  const now = Date.now();
  const token = createReviewToken('martinez', now);
  assert.equal(validReviewToken(token, 'martinez', now), true);
  assert.equal(validReviewToken(token, 'rp', now), false);
  assert.equal(
    validReviewToken(token.replace('martinez', 'rp'), 'rp', now),
    false,
  );
  assert.equal(
    validReviewToken(token.slice(0, -1) + 'z', 'martinez', now),
    false,
  );
  assert.equal(validReviewToken(token, 'martinez', now + 86400001), false);
  assert.equal(validReviewToken(undefined, 'martinez', now), false);
  process.env.MARTINEZ_REVIEW_PASSWORD_HASH = 'rotated';
  assert.equal(validReviewToken(token, 'martinez', now), false);
  delete process.env.MARTINEZ_REVIEW_PASSWORD_HASH;
  assert.throws(() => createReviewToken('martinez', now));
});
