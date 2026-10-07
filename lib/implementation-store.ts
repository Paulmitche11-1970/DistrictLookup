import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { serviceOffer } from './service-offer';
import {
  implementationUpdateSchema,
  type ImplementationInput,
} from './implementation-model';
import { pacificDay } from './activity-model';
import type { Content } from './model';
import type { z } from 'zod';
export type ImplementationRequest = {
  id: string;
  agency: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  input: ImplementationInput;
  offer: ReturnType<typeof serviceOffer>;
  previewRevision: number;
  status:
    | 'requested'
    | 'reviewing'
    | 'building'
    | 'ready'
    | 'live'
    | 'cancelled';
  billingStatus: 'draft' | 'issued' | 'paid' | 'void';
  billingStarts: string;
  amountCents: number;
  owner: string;
  serviceStart: string;
  invoiceReference: string;
};
export class ImplementationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let connection: DatabaseSync | undefined;
export function implementationDatabase() {
  if (!connection) {
    const dir = process.env.DATA_DIR || path.join(process.cwd(), '.data');
    mkdirSync(dir, { recursive: true });
    connection = new DatabaseSync(path.join(dir, 'implementation.sqlite'));
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, agency TEXT NOT NULL, requestKey TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL, createdAt TEXT NOT NULL, payload TEXT NOT NULL, snapshot TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS active_agency_request ON requests(agency) WHERE status != 'cancelled';
      CREATE TABLE IF NOT EXISTS request_history (id INTEGER PRIMARY KEY, requestId TEXT NOT NULL, createdAt TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
    `);
  }
  return connection;
}
const parse = (row: unknown) =>
  row
    ? (JSON.parse(
        (row as { payload: string }).payload,
      ) as ImplementationRequest)
    : null;
export function implementationRequest(id: string) {
  return parse(
    implementationDatabase()
      .prepare('SELECT payload FROM requests WHERE id=?')
      .get(id),
  );
}
export function agencyImplementation(agency: string) {
  return parse(
    implementationDatabase()
      .prepare(
        "SELECT payload FROM requests WHERE agency=? AND status != 'cancelled'",
      )
      .get(agency),
  );
}
export function implementationRequests() {
  return implementationDatabase()
    .prepare('SELECT payload FROM requests ORDER BY createdAt DESC')
    .all()
    .map((row) => parse(row)!);
}
export function implementationHistory(id: string) {
  return implementationDatabase()
    .prepare(
      'SELECT createdAt,action,detail FROM request_history WHERE requestId=? ORDER BY id DESC',
    )
    .all(id) as { createdAt: string; action: string; detail: string }[];
}
export function implementationSnapshot(id: string) {
  return (
    implementationDatabase()
      .prepare('SELECT snapshot FROM requests WHERE id=?')
      .get(id) as { snapshot: string } | undefined
  )?.snapshot;
}
export function createImplementation(
  agency: string,
  input: ImplementationInput,
  snapshot: Content,
  revision: number,
) {
  const db = implementationDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const repeated = parse(
      db
        .prepare('SELECT payload FROM requests WHERE requestKey=?')
        .get(input.requestKey),
    );
    if (repeated) {
      if (repeated.agency !== agency)
        throw new ImplementationError(
          409,
          'Start a new request for this agency.',
        );
      db.exec('COMMIT');
      return { request: repeated, created: false };
    }
    if (agencyImplementation(agency))
      throw new ImplementationError(
        409,
        'Your agency already has an implementation request. Reload to see its status.',
      );
    if (revision !== input.revision)
      throw new ImplementationError(
        409,
        'Your preview changed. Reload and review it before confirming.',
      );
    const offer = serviceOffer(agency);
    if (input.offerVersion !== offer.version)
      throw new ImplementationError(
        409,
        'The offer has changed. Reload to review the current terms.',
      );
    const now = new Date().toISOString();
    const request: ImplementationRequest = {
      id: randomUUID(),
      agency,
      createdAt: now,
      updatedAt: now,
      version: 1,
      input,
      offer,
      previewRevision: revision,
      status: 'requested',
      billingStatus: 'draft',
      billingStarts: offer.billingStarts,
      amountCents:
        input.frequency === 'annual' ? offer.annualCents : offer.monthlyCents,
      owner: '',
      serviceStart: '',
      invoiceReference: '',
    };
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?)').run(
      request.id,
      agency,
      input.requestKey,
      request.status,
      now,
      JSON.stringify(request),
      JSON.stringify(snapshot),
    );
    db.prepare(
      'INSERT INTO request_history(requestId,createdAt,action,detail) VALUES(?,?,?,?)',
    ).run(
      request.id,
      now,
      'Agency confirmed',
      'Implementation request and first invoice draft created; no invoice sent or payment collected.',
    );
    db.exec('COMMIT');
    return { request, created: true };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function updateImplementation(
  input: z.infer<typeof implementationUpdateSchema>,
  today = pacificDay(),
) {
  const db = implementationDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const old = implementationRequest(input.id);
    if (!old) throw new ImplementationError(404, 'Request not found.');
    if (old.version !== input.version)
      throw new ImplementationError(
        409,
        'This request changed. Reload before saving.',
      );
    if (old.status === 'cancelled' && input.status !== 'cancelled')
      throw new ImplementationError(
        400,
        'A cancelled request cannot be reopened. The agency can submit a new request.',
      );
    if (
      input.status === 'live' &&
      (!input.serviceStart || input.serviceStart > today)
    )
      throw new ImplementationError(
        400,
        'A live service needs an actual start date, today or earlier.',
      );
    const billingStarts =
      input.serviceStart > old.offer.billingStarts
        ? input.serviceStart
        : old.offer.billingStarts;
    const transitions = {
      draft: ['draft', 'issued', 'void'],
      issued: ['issued', 'paid', 'void'],
      paid: ['paid'],
      void: ['void'],
    };
    if (!transitions[old.billingStatus].includes(input.billingStatus))
      throw new ImplementationError(
        400,
        'That invoice status transition is not allowed.',
      );
    if (['issued', 'paid'].includes(input.billingStatus)) {
      if (
        input.billingStatus !== old.billingStatus &&
        (input.status !== 'live' || billingStarts > today)
      )
        throw new ImplementationError(
          400,
          'Billing can start only after the free offer ends and the service is live.',
        );
      if (!input.invoiceReference)
        throw new ImplementationError(
          400,
          'Enter the reference for the invoice issued through your billing system.',
        );
    }
    if (old.billingStatus !== 'draft' && billingStarts !== old.billingStarts)
      throw new ImplementationError(
        400,
        'The service start cannot change the billing date of a finalized invoice.',
      );
    if (input.status === 'cancelled' && input.billingStatus === 'draft')
      throw new ImplementationError(
        400,
        'Void the draft when cancelling a request.',
      );
    const next: ImplementationRequest = {
      ...old,
      version: old.version + 1,
      updatedAt: new Date().toISOString(),
      status: input.status,
      billingStatus: input.billingStatus,
      serviceStart: input.serviceStart,
      owner: input.owner,
      invoiceReference: input.invoiceReference,
      billingStarts,
    };
    db.prepare('UPDATE requests SET status=?,payload=? WHERE id=?').run(
      next.status,
      JSON.stringify(next),
      next.id,
    );
    db.prepare(
      'INSERT INTO request_history(requestId,createdAt,action,detail) VALUES(?,?,?,?)',
    ).run(
      next.id,
      next.updatedAt,
      'RP workflow updated',
      `${old.status} → ${next.status}; invoice ${old.billingStatus} → ${next.billingStatus}. ${input.note}`,
    );
    db.exec('COMMIT');
    return next;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
