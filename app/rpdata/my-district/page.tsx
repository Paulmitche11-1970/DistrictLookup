import { ArrowRight, Check, MapPin, Pencil, PanelsTopLeft } from 'lucide-react';
import { Contact, contactHref } from '../site';
import styles from '../page.module.css';
export const metadata = {
  title: 'My District',
  description:
    'A public address lookup that connects residents with their districts and elected officials. Four layouts, your branding, and editable agency information.',
  alternates: { canonical: 'https://rpdata.net/my-district' },
};
const layouts = [
  {
    file: 'classic',
    route: 'classic',
    title: 'Classic',
    description:
      'Address search, representative information, and a map together in a familiar layout.',
  },
  {
    file: 'concierge',
    route: 'concierge',
    title: 'Concierge',
    description:
      'A focused, guided experience that starts with the resident’s address.',
  },
  {
    file: 'explorer',
    route: 'explorer',
    title: 'Explorer',
    description:
      'A map-led experience for people who want to explore the geography.',
  },
  {
    file: 'directory',
    route: 'council',
    title: 'Presentation',
    description:
      'A welcoming introduction to the people who serve your community.',
  },
];
export default function Page() {
  return (
    <>
      <section className={styles.productHero}>
        <p className={styles.eyebrow}>My District · A tool from RP Data</p>
        <h1>
          Your community.
          <br />
          <em>A clearer connection.</em>
        </h1>
        <p className={styles.lead}>
          A simple question deserves a clear answer: who represents me? Give
          residents an address lookup that puts their district, their elected
          officials, and useful contact information in one place.
        </p>
        <div className={styles.actions}>
          <a
            className={styles.button}
            href="https://wheresmydistrict.com/martinez/classic"
          >
            Try a live example <ArrowRight size={18} />
          </a>
          <a className={styles.textLink} href={contactHref}>
            Bring it to your agency <ArrowRight size={18} />
          </a>
        </div>
      </section>
      <section
        className={styles.productFeatures}
        aria-label="My District features"
      >
        {[
          {
            Icon: MapPin,
            title: 'Start with an address',
            text: 'Find a district, see a location on the map, and connect with the representatives who serve that area.',
          },
          {
            Icon: PanelsTopLeft,
            title: 'Fit your website',
            text: 'Use a page hosted by RP Data or embed the lookup on your existing website. Choose a layout and add your agency branding.',
          },
          {
            Icon: Pencil,
            title: 'Keep it current',
            text: 'Your agency can update names, photos, biographies, dates, and contact information through a protected administration workspace.',
          },
        ].map(({ Icon, title, text }) => (
          <article key={title}>
            <Icon size={27} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className={styles.layouts}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Four starting points</p>
            <h2>
              Your information.
              <br />
              Your preferred layout.
            </h2>
          </div>
          <p>
            All four designs use the same agency information. Publish an update
            once and it appears across the layouts.
          </p>
        </div>
        <div className={styles.layoutGrid}>
          {layouts.map((layout) => (
            <a
              key={layout.file}
              href={`https://wheresmydistrict.com/martinez/${layout.route}`}
            >
              <img
                src={`/design-previews/${layout.file}.webp`}
                alt={`Martinez example of the ${layout.title} lookup layout`}
                width={1440}
                height={1000}
                loading="lazy"
              />
              <div>
                <h3>
                  {layout.title}
                  <ArrowRight size={19} />
                </h3>
                <p>{layout.description}</p>
                <span>Open example</span>
              </div>
            </a>
          ))}
        </div>
      </section>
      <section className={styles.offer}>
        <div>
          <p className={styles.eyebrow}>An invitation to your agency</p>
          <h2>
            Free until
            <br />
            July 1, 2027.
          </h2>
          <p className={styles.price}>
            Then <strong>$75/month</strong> or <strong>$900/year.</strong>
          </p>
          <a className={styles.button} href={contactHref}>
            Request an agency preview <ArrowRight size={18} />
          </a>
        </div>
        <ul>
          {[
            'Your agency’s map, branding, and representatives',
            'Four preset layouts to choose from',
            'Hosted page or website embed',
            'Editable photos, biographies, and contact details',
            'Options to control which information residents see',
          ].map((x) => (
            <li key={x}>
              <Check size={18} />
              {x}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.relationship}>
        <h2>Have something else in mind?</h2>
        <p>
          We welcome feature requests and can discuss changes to meet your
          agency’s needs. From a city council to a school board or water
          district, the experience should fit the people using it.
        </p>
      </section>
      <Contact />
    </>
  );
}
