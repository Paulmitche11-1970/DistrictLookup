import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Mail, Phone, Globe } from 'lucide-react';
import { inAgency } from '@/lib/agency-scope';
import { adminPath, instanceFor } from '@/lib/instances';
import { publicContent, state, visibleContent } from '@/lib/store';
import { requireAdmin } from '@/lib/security';
import { biographyHtml } from '@/lib/biography-html';
import { hasBiography } from '@/lib/biography';
import { constituencyLabel, titleLabel } from '@/lib/representation';
import { phoneHref, termLabel } from '@/lib/model';
import { designs } from '@/lib/designs';
import { Brand, LookupFooter } from './lookup-shared';

export async function OfficialBiographyPage({
  agencyId,
  officialId,
  preview,
  design,
}: {
  agencyId: string;
  officialId: string;
  preview: boolean;
  design?: string;
}) {
  const instance = instanceFor(agencyId);
  if (!instance) notFound();
  return inAgency(instance.id, async () => {
    if (preview) {
      try {
        await requireAdmin();
      } catch {
        const next = `/${instance.id}/officials/${encodeURIComponent(officialId)}?preview=1`;
        redirect(
          instance.sandbox
            ? `/review-access?scope=rp&next=${encodeURIComponent(next)}`
            : adminPath(instance.id) + '/login',
        );
      }
    }
    const content = preview ? visibleContent(state().draft) : publicContent();
    const official = content.officials.find(
      (o) => o.id === officialId && !o.vacant,
    );
    if (
      !official ||
      content.agency.showBiographies === false ||
      !hasBiography(official)
    )
      notFound();
    const a = content.agency;
    const currentDesign =
      designs.find((d) => d.id === design)?.id || a.lookupDesign || 'classic';
    const back = `/${instance.id}/${preview ? 'preview' : 'lookup'}?design=${currentDesign}`;
    const html = biographyHtml(official, a.showPhotos);
    return (
      <div
        className="biography-page"
        style={{ '--primary': a.accent } as React.CSSProperties}
      >
        <header className="biography-header">
          <Brand
            name={a.shortName}
            agencyId={instance.id}
            sandbox={a.sandbox}
          />
          <a className="biography-back" href={back}>
            <ArrowLeft size={17} /> District lookup
          </a>
        </header>
        {preview && (
          <div className="biography-preview" role="status">
            Unpublished biography preview · Save and publish changes in
            administration to update all four public layouts.
          </div>
        )}
        <main>
          <section className="biography-hero" aria-labelledby="official-name">
            {a.showPhotos && official.photo && (
              <img
                className="biography-portrait"
                src={official.photo}
                alt={official.name}
              />
            )}
            <div>
              <p className="eyebrow">{a.name}</p>
              <p className="biography-office">
                {titleLabel(official)} · {constituencyLabel(official)}
              </p>
              <h1 id="official-name">{official.name}</h1>
              {official.termEnd && (
                <p className="term">Term ends {termLabel(official.termEnd)}</p>
              )}
            </div>
          </section>
          <div className="biography-columns">
            <article className="biography-article">
              <h2>Biography</h2>
              <div
                className="biography-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </article>
            <aside
              className="biography-contact"
              aria-label={`Contact ${official.name}`}
            >
              <h2>Get in touch</h2>
              <p className="small muted">
                {titleLabel(official)}
                <br />
                {a.name}
              </p>
              <div className="contact-list">
                {official.email && (
                  <a href={'mailto:' + official.email}>
                    <Mail size={18} />
                    <span>{official.email}</span>
                  </a>
                )}
                {official.phone && (
                  <a href={phoneHref(official.phone)}>
                    <Phone size={18} />
                    <span>
                      {official.phone}
                      <small>{official.phoneLabel}</small>
                    </span>
                  </a>
                )}
                {official.website && (
                  <a
                    href={official.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe size={18} />
                    <span>Official website</span>
                    <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
              {official.staffName && (
                <div className="biography-staff">
                  <strong>{official.staffName}</strong>
                  {official.staffEmail && (
                    <a href={'mailto:' + official.staffEmail}>
                      {official.staffEmail}
                    </a>
                  )}
                  {official.staffPhone && (
                    <a href={phoneHref(official.staffPhone)}>
                      {official.staffPhone}
                    </a>
                  )}
                </div>
              )}
              <a className="biography-back" href={back}>
                <ArrowLeft size={16} /> Find your district
              </a>
            </aside>
          </div>
        </main>
        <LookupFooter content={content} />
      </div>
    );
  });
}
