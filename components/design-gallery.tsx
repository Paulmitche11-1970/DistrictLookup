import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { Content } from '@/lib/model';
import { instanceFor, adminPath } from '@/lib/instances';
import { designs } from '@/lib/designs';
import { ManagementProfiles } from './management-profiles';
import { agencyLabels, agencyDesignCopy } from '@/lib/agency-labels';

export default function DesignGallery({
  content,
  staff = false,
}: {
  content: Content;
  staff?: boolean;
}) {
  const instance = instanceFor(content.agency.instanceId || 'martinez')!;
  const labels = agencyLabels(instance);
  const boardAgency = ['special', 'school', 'college'].includes(instance.kind);
  const copy = (text: string) =>
    boardAgency ? agencyDesignCopy(text, instance) : text;
  const base = '/' + instance.id;
  const preview =
    instance.previewDirectory || '/design-previews/' + instance.id;
  const designPath = (path: string) => path.replace('/martinez', base);
  return (
    <div className="design-gallery">
      <header className="gallery-header">
        <a href={staff ? '/' : base} className="rp-gallery-brand">
          <span>RP</span> RP Data
        </a>
        <span className="gallery-review-label">
          {content.agency.shortName.toUpperCase()} · DESIGN REVIEW
        </span>
        {staff ? (
          <a href="/">
            All agencies <ArrowRight size={15} />
          </a>
        ) : (
          <a
            href={
              instance.sandbox
                ? base + '/administration'
                : adminPath(instance.id)
            }
          >
            Agency sign in <ArrowRight size={15} />
          </a>
        )}
      </header>
      <main className="gallery-main">
        <div className="gallery-intro">
          <div>
            {instance.logo ? (
              <img
                className="gallery-city-logo"
                src={instance.logo}
                alt={content.agency.name}
                width={490}
                height={112}
              />
            ) : (
              <p className="gallery-agency-name">{content.agency.name}</p>
            )}
            <h1>
              One {labels.place}.
              <br />
              <em>Four ways to connect.</em>
            </h1>
          </div>
          <p>
            Explore four lookup designs for {content.agency.name}. Try an
            address and choose your preferred experience. Then take a look
            inside the administration workspace.
          </p>
        </div>
        <div className="gallery-shared">
          <span>
            <Check size={16} /> Same {content.agency.shortName} address search
          </span>
          <span>
            <Check size={16} /> Same {labels.districtsLower} & officials
          </span>
          <span>
            <Check size={16} /> Street & satellite maps
          </span>
          <span>
            <Check size={16} /> One shared administration system
          </span>
        </div>
        <section
          className="design-options"
          aria-label="Compare four lookup designs and administration"
        >
          {designs.map((design) => (
            <article className="design-option" key={design.id}>
              <a
                className="design-screenshot-link"
                href={designPath(design.path)}
                aria-label={`View ${design.name} design`}
              >
                <img
                  className="design-screenshot"
                  src={`${preview}/${design.id}.webp`}
                  alt={`Screenshot of the ${content.agency.shortName} ${design.name} lookup design`}
                  width={1280}
                  height={800}
                />
              </a>
              <div className="design-option-copy">
                <div className="design-option-title">
                  <span>{design.number}</span>
                  <h2>{design.name}</h2>
                  <a
                    href={designPath(design.path)}
                    aria-label={`Open ${design.name} design`}
                  >
                    <ArrowRight size={22} />
                  </a>
                </div>
                <h3>
                  {instance.kind === 'county'
                    ? design.label.replace('city', 'county')
                    : copy(design.label)}
                </h3>
                <p>
                  {instance.kind === 'county'
                    ? design.description.replace('council', 'board')
                    : copy(design.description)}
                </p>
                <div className="design-fit">
                  <strong>Best fit</strong>
                  <p>{copy(design.bestFor)}</p>
                </div>
                <details>
                  <summary>What informed this design</summary>
                  <p>{copy(design.lesson)}</p>
                </details>
                <a className="design-open" href={designPath(design.path)}>
                  Try {design.name} <ArrowRight size={17} />
                </a>
              </div>
            </article>
          ))}
          <article className="design-option admin-design-card">
            <a
              className="design-screenshot-link"
              href={base + '/administration'}
            >
              <img
                className="design-screenshot"
                src={`${preview}/administration.webp`}
                alt={`Screenshot of the ${content.agency.shortName} administration workspace`}
                width={1280}
                height={800}
              />
            </a>
            <div className="design-option-copy">
              <div className="design-option-title">
                <LockKeyhole size={21} />
                <h2>Administration</h2>
              </div>
              <h3>One workspace. Every design.</h3>
              <p>
                Maintain elected officials, portraits, contact information,
                display preferences, and {labels.districtLower} boundaries.
                Review drafts, publish changes, and choose a design to embed on
                the agency website.
              </p>
              <div className="design-fit">
                <strong>Protected agency access</strong>
                <p>
                  {instance.sandbox
                    ? 'Open the workspace to edit officials, upload portraits, and try the draft and publish controls.'
                    : 'The live workspace uses password and two-factor authentication. This preview is read only and shows published agency information.'}
                </p>
              </div>
              <a className="design-open" href={base + '/administration'}>
                {instance.sandbox
                  ? 'Open administration'
                  : 'Explore administration preview'}{' '}
                <ArrowRight size={17} />
              </a>
            </div>
          </article>
        </section>
        <ManagementProfiles content={content} />
        <footer className="gallery-footer">
          <span>
            Screenshots show the initial designs. Open a design to see the
            latest published agency information.
          </span>
          {content.sourceUrl && (
            <a href={content.sourceUrl} target="_blank" rel="noreferrer">
              Agency source information <ArrowRight size={14} />
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}
