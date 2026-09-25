import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { sanitizeWebsiteHtml } from '@/lib/website-html';
import type {
  WebsitePage,
  WebsiteSettings,
  WebsiteSection,
} from '@/lib/website-model';
import { DataLandscape } from './website-landscape';
import styles from '@/app/rpdata/page.module.css';

function href(link: string, base: string) {
  return link.startsWith('/') && !link.startsWith('/rpdata/')
    ? base + link
    : link;
}
export function WebsiteHtml({
  html,
  base = '',
}: {
  html: string;
  base?: string;
}) {
  const clean = sanitizeWebsiteHtml(html).replace(
    /href="(\/(?!\/)[^"]*)"/g,
    (_match, link: string) => `href="${href(link, base)}"`,
  );
  return (
    <div
      className={styles.cmsRich}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
function Title({ value, hero = false }: { value: string; hero?: boolean }) {
  if (!value) return null;
  const lines = value.split('\n');
  if (hero)
    return (
      <h1>
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {i === lines.length - 1 && i > 0 ? <em>{line}</em> : line}
          </span>
        ))}
      </h1>
    );
  return <h2 className={styles.cmsTitle}>{value}</h2>;
}
function SectionLink({
  section,
  base,
  button = false,
}: {
  section: Pick<WebsiteSection, 'link' | 'linkLabel'>;
  base: string;
  button?: boolean;
}) {
  return section.link && section.linkLabel ? (
    <a
      className={button ? styles.button : styles.textLink}
      href={href(section.link, base)}
    >
      {section.linkLabel}
      <ArrowRight size={18} />
    </a>
  ) : null;
}
function Intro({
  section,
  base,
  hero = false,
}: {
  section: WebsiteSection;
  base: string;
  hero?: boolean;
}) {
  return (
    <div>
      {section.eyebrow && <p className={styles.eyebrow}>{section.eyebrow}</p>}
      <Title value={section.title} hero={hero} />
      <WebsiteHtml html={section.body} base={base} />
      <SectionLink section={section} base={base} button={hero} />
    </div>
  );
}
export function WebsiteContent({
  page,
  base = '',
}: {
  page: WebsitePage;
  base?: string;
}) {
  return (
    <>
      {page.sections.map((section) => {
        if (section.type === 'hero')
          return (
            <section key={section.id} id={section.id} className={styles.hero}>
              <Intro section={section} base={base} hero />
              {section.image ? (
                <img
                  className={styles.cmsHeroImage}
                  src={section.image}
                  alt={section.alt}
                />
              ) : (
                <DataLandscape />
              )}
            </section>
          );
        if (section.type === 'intro')
          return (
            <section
              key={section.id}
              id={section.id}
              className={styles.pageIntro}
            >
              <Intro section={section} base={base} hero />
              {section.image && (
                <img
                  className={styles.cmsHeroImage}
                  src={section.image}
                  alt={section.alt}
                />
              )}
            </section>
          );
        if (section.type === 'split')
          return (
            <section
              key={section.id}
              id={section.id}
              className={styles.productFeature}
            >
              {section.image && (
                <div className={styles.productImage}>
                  <img src={section.image} alt={section.alt} loading="lazy" />
                </div>
              )}
              <Intro section={section} base={base} />
            </section>
          );
        if (section.type === 'profiles')
          return (
            <section
              key={section.id}
              id={section.id}
              aria-label={section.title || 'Our team'}
            >
              <Intro section={section} base={base} />
              <div className={styles.teamGrid}>
                {section.items.map((item, i) => (
                  <article key={i} className={styles.person}>
                    {item.image && (
                      <div className={styles.portrait}>
                        <img
                          src={item.image}
                          alt={item.alt}
                          width={600}
                          height={600}
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className={styles.personText}>
                      <p className={styles.eyebrow}>{item.subtitle}</p>
                      <h2>{item.title}</h2>
                      <WebsiteHtml html={item.body} base={base} />
                      <SectionLink section={item} base={base} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        if (section.type === 'services')
          return (
            <section
              key={section.id}
              id={section.id}
              className={styles.servicesSection}
            >
              {(section.title || section.body) && (
                <div className={styles.cmsSectionHeading}>
                  <Intro section={section} base={base} />
                </div>
              )}
              <div className={styles.cmsServices}>
                {section.items.map((item, i) => (
                  <article key={i} id={item.id || undefined}>
                    <span className={styles.number}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      {item.subtitle && <p>{item.subtitle}</p>}
                    </div>
                    <div>
                      <WebsiteHtml html={item.body} base={base} />
                      <SectionLink section={item} base={base} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        if (section.type === 'cards')
          return (
            <section
              key={section.id}
              id={section.id}
              className={styles.layouts}
            >
              {(section.title || section.body) && (
                <div className={styles.cmsSectionHeading}>
                  <Intro section={section} base={base} />
                </div>
              )}
              <div className={styles.cmsCards}>
                {section.items.map((item, i) => (
                  <article key={i}>
                    {item.image && (
                      <img src={item.image} alt={item.alt} loading="lazy" />
                    )}
                    <div>
                      <p className={styles.eyebrow}>{item.subtitle}</p>
                      <h3>{item.title}</h3>
                      <WebsiteHtml html={item.body} base={base} />
                      <SectionLink section={item} base={base} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        return (
          <section
            key={section.id}
            id={section.id}
            className={
              section.type === 'offer' ? styles.cmsOffer : styles.relationship
            }
          >
            <Intro section={section} base={base} />
            {section.image && (
              <img
                className={styles.cmsHeroImage}
                src={section.image}
                alt={section.alt}
                loading="lazy"
              />
            )}
          </section>
        );
      })}
    </>
  );
}
export function WebsiteShell({
  settings,
  pages,
  base = '',
  children,
}: {
  settings: WebsiteSettings;
  pages: WebsitePage[];
  base?: string;
  children: React.ReactNode;
}) {
  const visible = pages
    .filter((p) => p.showInNav)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const contact =
    'mailto:' + settings.contactEmail + '?subject=RP%20Data%20inquiry';
  const brand = (
    <>
      {settings.logo ? (
        <img className={styles.cmsLogo} src={settings.logo} alt="" />
      ) : (
        <span className={styles.mark}>
          rp<span>:</span>
        </span>
      )}
      <span>{settings.siteName}</span>
    </>
  );
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#rpdata-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <a
          className={styles.brand}
          href={base || '/'}
          aria-label={settings.siteName + ' home'}
        >
          {brand}
        </a>
        <nav aria-label="RP Data navigation">
          {visible.map((p) => (
            <a key={p.slug} href={base + '/' + p.slug}>
              {p.navLabel}
            </a>
          ))}
          <a className={styles.navContact} href="#contact">
            Let’s talk <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <main id="rpdata-content">
        {children}
        <section className={styles.contact} id="contact">
          <div>
            <p className={styles.eyebrow}>{settings.contactEyebrow}</p>
            <Title value={settings.contactTitle} />
          </div>
          <div>
            <WebsiteHtml html={settings.contactBody} base={base} />
            <a className={styles.lightButton} href={contact}>
              {settings.contactButton}
              <ArrowUpRight size={18} />
            </a>
            <a className={styles.contactEmail} href={contact}>
              {settings.contactEmail}
            </a>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div>
          <a className={styles.brand} href={base || '/'}>
            {brand}
          </a>
          <p>{settings.tagline}</p>
        </div>
        <div>
          <p>{settings.description}</p>
          {settings.partnerUrl && (
            <a href={settings.partnerUrl}>
              {settings.partnerLabel}
              <ArrowUpRight size={14} />
            </a>
          )}
        </div>
        <div>
          {visible
            .filter((p) => p.slug)
            .map((p) => (
              <a key={p.slug} href={base + '/' + p.slug}>
                {p.navLabel}
              </a>
            ))}
          <span>
            © {new Date().getFullYear()} {settings.siteName}
          </span>
        </div>
      </footer>
    </div>
  );
}
