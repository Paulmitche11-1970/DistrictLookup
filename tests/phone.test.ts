import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneHref } from '../lib/model';
void test('Public office phone extensions remain separate from dialed numbers', () => {
  assert.equal(
    phoneHref('(650) 522-7522 ext. 6265'),
    'tel:6505227522;ext=6265',
  );
  assert.equal(phoneHref('+1 650 522 7522 x6265'), 'tel:+16505227522;ext=6265');
  assert.equal(phoneHref('530-666-8195'), 'tel:5306668195');
});
