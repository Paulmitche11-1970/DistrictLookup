import { notFound } from 'next/navigation';
import { requireReviewAccess } from '@/lib/review-access';
import {
  implementationRequest,
  implementationHistory,
} from '@/lib/implementation-store';
import { instanceFor } from '@/lib/instances';
import { designs } from '@/lib/designs';
import { ImplementationWorkflow } from '@/components/implementation-workflow';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Implementation request | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireReviewAccess('rp', '/admin/outreach/' + id);
  const r = implementationRequest(id);
  if (!r) notFound();
  const agency = instanceFor(r.agency)!;
  return (
    <main className="implementation-page outreach-detail">
      <nav>
        <a href="/admin/outreach">← Outreach & implementation</a>
        <a href="/admin">RP administration</a>
      </nav>
      <p className="eyebrow">
        IMPLEMENTATION REQUEST · {r.id.slice(0, 8).toUpperCase()}
      </p>
      <h1>{agency.name}</h1>
      <p>
        Received{' '}
        {new Date(r.createdAt).toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
        })}{' '}
        Pacific · {r.status}
      </p>
      <section className="implementation-card">
        <h2>The agency’s selection</h2>
        <dl>
          <dt>Layout</dt>
          <dd>{designs.find((d) => d.id === r.input.layout)?.name}</dd>
          <dt>Delivery</dt>
          <dd>
            {
              {
                embed: 'Embed code',
                hosted: 'Dedicated RP-hosted link',
                both: 'Embed code and dedicated link',
                help: 'Help choosing',
              }[r.input.delivery]
            }
          </dd>
          <dt>Contact</dt>
          <dd>
            {r.input.name}, {r.input.title}
            <br />
            {r.input.email}
            <br />
            {r.input.phone}
          </dd>
          <dt>Agency website</dt>
          <dd>{r.input.website || 'Not supplied'}</dd>
          <dt>Requested changes</dt>
          <dd>
            <pre>{r.input.notes || 'None supplied'}</pre>
          </dd>
        </dl>
        <p>
          The agency confirmed authority to request implementation and
          acknowledged offer {r.offer.version}. Preview revision{' '}
          {r.previewRevision} was saved with the request. Later edits and resets
          do not change this copy.
        </p>
        <div className="outreach-actions">
          <a className="btn" href={'/admin/outreach/' + r.id + '/snapshot'}>
            Download submitted content
          </a>
          <a className="btn" href={'/' + r.agency}>
            Open current designs
          </a>
        </div>
      </section>
      <section className="implementation-card">
        <h2>Implementation checklist</h2>
        <ol>
          <li>
            Review the chosen layout, official information, and requested
            customizations with the agency.
          </li>
          <li>
            Confirm district boundaries and complete a final address lookup
            check.
          </li>
          <li>
            Prepare the hosted URL and/or embed code, then set up the agency’s
            live administrator account and two-factor authentication.
          </li>
          <li>
            Confirm launch with the agency, record the service start below, and
            schedule billing after the free period.
          </li>
        </ol>
      </section>
      <section className="implementation-card">
        <h2>First invoice · {r.billingStatus}</h2>
        <div className="implementation-offer">
          <strong>{r.offer.headline}</strong>
          <p>
            ${r.amountCents / 100} {r.offer.currency} per{' '}
            {r.input.frequency === 'annual' ? 'year' : 'month'}. Paid service
            starts no earlier than {r.billingStarts}; a later launch moves the
            first billing date forward.
          </p>
        </div>
        <dl>
          <dt>Bill to</dt>
          <dd>
            {agency.name}
            <br />
            {r.input.billingName}
            <br />
            {r.input.billingEmail}
            <pre>{r.input.billingAddress}</pre>
          </dd>
          <dt>Invoice reference</dt>
          <dd>{r.invoiceReference || 'Draft only — not issued'}</dd>
        </dl>
        <p>
          This is a first-invoice draft and billing reminder. No invoice has
          been sent by this application; recurring billing must be configured in
          your billing system.
        </p>
      </section>
      <section className="implementation-card">
        <h2>RP workflow</h2>
        <ImplementationWorkflow key={r.version} request={r} />
      </section>
      <section className="implementation-card">
        <h2>History</h2>
        {implementationHistory(id).map((h, i) => (
          <div key={i}>
            <strong>{h.action}</strong>
            <p>
              {new Date(h.createdAt).toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles',
              })}{' '}
              Pacific · {h.detail}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
