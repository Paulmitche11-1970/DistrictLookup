import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { siteBase } from './site';
import styles from './page.module.css';
export const metadata: Metadata = {
  title: {
    default: 'RP Data | Data. Place. Perspective.',
    template: '%s | RP Data',
  },
  description:
    'The home of data and analysis for Redistricting Partners and related projects. Census consulting, outreach, GIS, data analysis, and My District.',
  robots: { index: true, follow: true },
  icons: { icon: '/rpdata-mark.svg' },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const base = await siteBase();
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#rpdata-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <a
          className={styles.brand}
          href={base || '/'}
          aria-label="RP Data home"
        >
          <span className={styles.mark}>
            rp<span>:</span>
          </span>
          <span>
            RP <strong>Data</strong>
          </span>
        </a>
        <nav aria-label="RP Data navigation">
          <a href={base || '/'}>Home</a>
          <a href={`${base}/what-we-do`}>What We Do</a>
          <a href={`${base}/about`}>About Us</a>
          <a href={`${base}/my-district`}>My District</a>
          <a className={styles.navContact} href="#contact">
            Let’s talk <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <main id="rpdata-content">{children}</main>
      <footer className={styles.footer}>
        <div>
          <a className={styles.brand} href={base || '/'}>
            <span className={styles.mark}>
              rp<span>:</span>
            </span>
            <span>
              RP <strong>Data</strong>
            </span>
          </a>
          <p>Data. Place. Perspective.</p>
        </div>
        <div>
          <p>
            The home of data and analysis for
            <br />
            Redistricting Partners and related projects.
          </p>
          <a href="https://redistrictingpartners.com/">
            Visit Redistricting Partners <ArrowUpRight size={14} />
          </a>
        </div>
        <div>
          <a href={`${base}/what-we-do`}>What We Do</a>
          <a href={`${base}/about`}>About Us</a>
          <a href={`${base}/my-district`}>My District</a>
          <span>© {new Date().getFullYear()} RP Data</span>
        </div>
      </footer>
    </div>
  );
}
