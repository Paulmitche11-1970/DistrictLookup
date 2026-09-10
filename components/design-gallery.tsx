import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { Content } from '@/lib/model';
import { designs } from '@/lib/designs';

export default function DesignGallery({
  content,
  staff = false,
}: {
  content: Content;
  staff?: boolean;
}) {
  return (
    <div className="design-gallery">
      <header className="gallery-header">
        <a href={staff ? '/' : '/martinez'} className="rp-gallery-brand">
          <span>RP</span> RP Data
        </a>
        <span className="gallery-review-label">MARTINEZ · DESIGN REVIEW</span>
        {staff ? (
          <a href="/">
            All agencies <ArrowRight size={15} />
          </a>
        ) : (
          <a href="/admin">
            Agency sign in <ArrowRight size={15} />
          </a>
        )}
      </header>
      <main className="gallery-main">
        <div className="gallery-intro">
          <div>
            <span className="eyebrow">City of Martinez, California</span>
            <h1>
              One city.
              <br />
              <em>Four ways to connect.</em>
            </h1>
          </div>
          <p>
            Explore four lookup designs for the City of Martinez. Try an address
            and choose your preferred experience. Then take a look inside the
            administration workspace.
          </p>
        </div>
        <div className="gallery-shared">
          <span>
            <Check size={16} /> Same Martinez address search
          </span>
          <span>
            <Check size={16} /> Same districts & officials
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
                href={design.path}
                aria-label={`View ${design.name} design`}
              >
                <img
                  className="design-screenshot"
                  src={`/design-previews/${design.id}.webp`}
                  alt={`Screenshot of the Martinez ${design.name} lookup design`}
                  width={1280}
                  height={800}
                />
              </a>
              <div className="design-option-copy">
                <div className="design-option-title">
                  <span>{design.number}</span>
                  <h2>{design.name}</h2>
                  <a
                    href={design.path}
                    aria-label={`Open ${design.name} design`}
                  >
                    <ArrowRight size={22} />
                  </a>
                </div>
                <h3>{design.label}</h3>
                <p>{design.description}</p>
                <div className="design-fit">
                  <strong>Best fit</strong>
                  <p>{design.bestFor}</p>
                </div>
                <details>
                  <summary>What informed this design</summary>
                  <p>{design.lesson}</p>
                </details>
                <a className="design-open" href={design.path}>
                  Try {design.name} <ArrowRight size={17} />
                </a>
              </div>
            </article>
          ))}
          <article className="design-option admin-design-card">
            <a
              className="design-screenshot-link"
              href="/martinez/administration"
            >
              <img
                className="design-screenshot"
                src="/design-previews/administration.webp"
                alt="Screenshot of the Martinez administration workspace showing elected officials and publication controls"
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
                display preferences, and district boundaries. Review drafts,
                publish changes, and choose a design to embed on the agency
                website.
              </p>
              <div className="design-fit">
                <strong>Protected agency access</strong>
                <p>
                  The live workspace uses password and two-factor
                  authentication. This public preview is read only and shows
                  published agency information.
                </p>
              </div>
              <a className="design-open" href="/martinez/administration">
                Explore administration preview <ArrowRight size={17} />
              </a>
            </div>
          </article>
        </section>
        <footer className="gallery-footer">
          <span>
            Screenshots show the initial designs. Open a design to see the
            latest published agency information.
          </span>
          <a href={content.sourceUrl} target="_blank" rel="noreferrer">
            Agency source information <ArrowRight size={14} />
          </a>
        </footer>
      </main>
    </div>
  );
}
