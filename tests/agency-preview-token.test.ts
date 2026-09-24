import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agencyPreviewToken,
  agencySendingPath,
  validAgencyPreviewToken,
} from '../lib/agency-preview-token';
import { validReviewToken } from '../lib/review-token';

void test('Sending links are agency-bound, stable, separately scoped, and revocable', () => {
  process.env.APP_SECRET = 'agency-sending-link-test-secret-'.repeat(3);
  process.env.RP_REVIEW_PASSWORD_HASH = 'rp-test';
  const token = agencyPreviewToken('galt');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(agencyPreviewToken('galt'), token);
  assert.equal(agencySendingPath('galt'), '/send/galt/' + token);
  assert.equal(validAgencyPreviewToken('galt', token), true);
  assert.equal(validAgencyPreviewToken('martinez', token), false);
  assert.equal(validAgencyPreviewToken('rp', token), false);
  assert.equal(validAgencyPreviewToken('not-an-agency', token), false);
  assert.equal(validAgencyPreviewToken('galt', token.slice(1)), false);
  assert.equal(validAgencyPreviewToken('galt', 'GALTPreview'), false);
  assert.equal(validReviewToken(token, 'rp'), false);
  assert.equal(validReviewToken(token, 'martinez'), false);
  const other = agencyPreviewToken('barstow-college');
  process.env.AGENCY_PREVIEW_REVISION_GALT = '2';
  assert.equal(validAgencyPreviewToken('galt', token), false);
  assert.equal(validAgencyPreviewToken('barstow-college', other), true);
  delete process.env.AGENCY_PREVIEW_REVISION_GALT;
  delete process.env.APP_SECRET;
  assert.equal(agencySendingPath('galt'), '');
  assert.equal(validAgencyPreviewToken('galt', token), false);
});
