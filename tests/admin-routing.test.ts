import assert from 'node:assert/strict';
import test from 'node:test';
import { adminPath, apiPath, instances } from '../lib/instances';
import { reviewDestination } from '../lib/review-destination';

void test('Agency admin routes never resolve to the RP administration hub', () => {
  for (const instance of instances)
    assert.equal(adminPath(instance.id), `/${instance.id}/admin`);
  assert.equal(apiPath('martinez'), '/api');
  assert.equal(apiPath('belmont'), '/api/agencies/belmont');
});

void test('Only RP review access can return to the administration hub', () => {
  assert.equal(reviewDestination('rp', '/admin'), '/admin');
  assert.equal(reviewDestination('martinez', '/admin'), '/martinez');
  for (const next of [
    '/admin/login',
    '/admin/setup',
    '/admin/preview',
    '//example.com/admin',
  ]) {
    assert.equal(reviewDestination('rp', next), '/');
    assert.equal(reviewDestination('martinez', next), '/martinez');
  }
});
