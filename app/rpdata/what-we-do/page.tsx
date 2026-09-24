import { ArrowRight } from 'lucide-react';
import { Contact, services, siteBase } from '../site';
import styles from '../page.module.css';
export const metadata = {
  title: 'What We Do',
  description:
    'Census data consulting, Census outreach, GIS and mapping, data analysis, and the My District lookup tool.',
  alternates: { canonical: 'https://rpdata.net/what-we-do' },
};
export default async function Page() {
  const base = await siteBase();
  return (
    <>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>What we do</p>
        <h1>
          Make information
          <br />
          <em>work for you.</em>
        </h1>
        <p className={styles.lead}>
          Understand a population. Plan your outreach. Put a question on a map.
          We bring research and practical tools to the work you need to do.
        </p>
      </section>
      <nav className={styles.serviceNav} aria-label="Our services">
        {services.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>
      <div className={styles.serviceDetails}>
        {services.map((s) => (
          <section key={s.id} id={s.id}>
            <span className={styles.number}>{s.number}</span>
            <div>
              <h2>{s.title}</h2>
              <p className={styles.serviceSummary}>{s.summary}</p>
              <p>{s.description}</p>
              {s.id === 'my-district' && (
                <a className={styles.textLink} href={`${base}/my-district`}>
                  See My District <ArrowRight size={18} />
                </a>
              )}
            </div>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Contact />
    </>
  );
}
