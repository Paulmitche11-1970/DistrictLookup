import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { serviceOffer } from '../lib/service-offer';
import {
  implementationSchema,
  type ImplementationInput,
} from '../lib/implementation-model';
import {
  createImplementation,
  updateImplementation,
  implementationHistory,
  implementationSnapshot,
  agencyImplementation,
  implementationRequests,
} from '../lib/implementation-store';
import type { Content } from '../lib/model';
const make = (agency = 'galt'): ImplementationInput => ({
  requestKey: randomUUID(),
  revision: 1,
  offerVersion: serviceOffer(agency).version,
  name: 'Agency reviewer',
  title: 'Administrator',
  email: 'reviewer@example.org',
  phone: '',
  website: 'https://agency.example.org',
  billingName: 'Accounts payable',
  billingEmail: 'billing@example.org',
  billingAddress: 'PO required',
  layout: 'explorer',
  delivery: 'both',
  frequency: 'annual',
  notes: 'Adjust the header.',
  authorized: true,
  pricingAccepted: true,
});
void test('Confirmation requires authority, pricing acknowledgement, valid contact details and allowlisted layout', () => {
  assert.ok(implementationSchema.safeParse(make()).success);
  for (const override of [
    { authorized: false },
    { pricingAccepted: false },
    { email: 'invalid' },
    { layout: 'random' },
    { website: 'javascript:alert(1)' },
    { amountCents: 1 },
    { offerVersion: 1 },
  ])
    assert.equal(
      implementationSchema.safeParse({ ...make(), ...override }).success,
      false,
    );
});
void test('Implementation creates one durable request and invoice draft, keeps snapshot immutable, and protects offers, retries and workflow', () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), 'rp-implementation-unit-'),
  );
  const snapshot = {
    agency: { name: 'Original agency' },
    officials: [],
  } as unknown as Content;
  const input = make();
  assert.throws(
    () => createImplementation('galt', { ...input, revision: 2 }, snapshot, 1),
    /preview changed/,
  );
  assert.throws(
    () =>
      createImplementation(
        'galt',
        { ...input, offerVersion: 'old' },
        snapshot,
        1,
      ),
    /offer has changed/,
  );
  const created = createImplementation('galt', input, snapshot, 1);
  assert.equal(created.created, true);
  assert.equal(created.request.billingStarts, '2027-07-01');
  assert.equal(created.request.amountCents, 90000);
  snapshot.agency.name = 'Later preview edit';
  assert.match(implementationSnapshot(created.request.id)!, /Original agency/);
  assert.equal(
    createImplementation('galt', input, snapshot, 9).created,
    false,
    'Retry must not create an invoice or fail after a preview edit',
  );
  assert.throws(
    () => createImplementation('martinez', input, snapshot, 1),
    /new request/,
  );
  assert.throws(
    () => createImplementation('galt', make(), snapshot, 1),
    /already has/,
  );
  assert.equal(implementationRequests().length, 1);
  const update = {
    id: created.request.id,
    version: 1,
    status: 'live' as const,
    billingStatus: 'issued' as const,
    serviceStart: '2026-10-07',
    owner: 'RP team',
    invoiceReference: 'INV-100',
    note: 'Reviewed',
  };
  assert.throws(
    () => updateImplementation(update, '2026-10-07'),
    /free offer ends/,
  );
  assert.throws(
    () =>
      updateImplementation(
        { ...update, billingStatus: 'draft', serviceStart: '' },
        '2026-10-07',
      ),
    /actual start date/,
  );
  const live = updateImplementation(
    { ...update, billingStatus: 'draft' },
    '2026-10-07',
  );
  assert.equal(live.version, 2);
  assert.equal(live.billingStarts, '2027-07-01');
  assert.throws(() => updateImplementation(update, '2027-07-01'), /Reload/);
  assert.throws(
    () =>
      updateImplementation(
        { ...update, version: 2, invoiceReference: '' },
        '2027-07-01',
      ),
    /reference/,
  );
  const issued = updateImplementation({ ...update, version: 2 }, '2027-07-01');
  assert.equal(issued.billingStatus, 'issued');
  assert.throws(
    () =>
      updateImplementation(
        { ...update, version: 3, billingStatus: 'draft' },
        '2027-07-01',
      ),
    /transition/,
  );
  const paid = updateImplementation(
    { ...update, version: 3, billingStatus: 'paid' },
    '2027-07-02',
  );
  assert.equal(paid.billingStatus, 'paid');
  assert.equal(implementationHistory(paid.id).length, 4);
  const sje = createImplementation(
    'san-jose-evergreen',
    { ...make('san-jose-evergreen'), frequency: 'monthly' },
    snapshot,
    1,
  ).request;
  assert.equal(sje.amountCents, 7500);
  assert.equal(sje.offer.freeThrough, '2031-12-31');
  assert.equal(sje.billingStarts, '2032-01-01');
  assert.throws(
    () =>
      updateImplementation({ ...update, id: sje.id, version: 1 }, '2031-12-31'),
    /free offer ends/,
  );
  const late = updateImplementation(
    {
      ...update,
      id: sje.id,
      version: 1,
      serviceStart: '2032-02-15',
      billingStatus: 'draft',
    },
    '2032-02-15',
  );
  assert.equal(late.billingStarts, '2032-02-15');
  assert.throws(
    () =>
      updateImplementation(
        {
          ...update,
          id: sje.id,
          version: 2,
          serviceStart: late.serviceStart,
          status: 'cancelled',
          billingStatus: 'draft',
        },
        '2032-02-15',
      ),
    /Void/,
  );
  updateImplementation(
    {
      ...update,
      id: sje.id,
      version: 2,
      serviceStart: late.serviceStart,
      status: 'cancelled',
      billingStatus: 'void',
    },
    '2032-02-15',
  );
  assert.equal(agencyImplementation('san-jose-evergreen'), null);
  assert.equal(
    createImplementation(
      'san-jose-evergreen',
      make('san-jose-evergreen'),
      snapshot,
      1,
    ).created,
    true,
  );
});
