import { notFound, redirect } from 'next/navigation';
import { instanceFor } from '@/lib/instances';
import {
  hasClientPreviewAccess,
  inViewerAgency,
} from '@/lib/client-preview-access';
import { state } from '@/lib/store';
import { agencyImplementation } from '@/lib/implementation-store';
import { ImplementationForm } from '@/components/implementation-form';
import { serviceOffer } from '@/lib/service-offer';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Use your district lookup | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  const { agency } = await params;
  const instance = instanceFor(agency);
  if (!instance) notFound();
  if (!(await hasClientPreviewAccess(instance.id)))
    redirect('/preview/' + instance.id);
  const current = await inViewerAgency(instance.id, state);
  const existing = agencyImplementation(instance.id);
  return (
    <main className="implementation-page">
      <nav>
        <a href={'/' + instance.id}>← Back to your four layouts</a>
        <a href="https://rpdata.net">RP Data</a>
      </nav>
      <header>
        <img src={instance.logo} alt="" />
        <p className="eyebrow">{instance.name}</p>
        <h1>Let’s put your lookup to work.</h1>
        <p>
          Choose the layout that fits your residents, tell us what you’d like
          adjusted, and we’ll help your team get it onto your website.
        </p>
      </header>
      {existing ? (
        <section className="implementation-card" role="status">
          <p className="eyebrow">REQUEST RECEIVED</p>
          <h2>Your implementation is {existing.status}.</h2>
          <p>
            Reference: {existing.id.slice(0, 8).toUpperCase()}. RP has your
            layout choice, contact details, and a saved copy of preview revision{' '}
            {existing.previewRevision}.
          </p>
          <p>
            {existing.offer.headline}. No payment has been collected here. We’ll
            coordinate setup and billing with your team.
          </p>
          <p>
            Further preview edits won’t change the submitted copy. Contact RP to
            adjust your request.
          </p>
          <a className="btn" href={'/' + instance.id}>
            Keep exploring
          </a>
        </section>
      ) : (
        <ImplementationForm
          agency={instance.id}
          revision={current.revision}
          offer={serviceOffer(instance.id)}
          initialLayout={current.published.agency.lookupDesign || 'classic'}
        />
      )}
    </main>
  );
}
