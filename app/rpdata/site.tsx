import { headers } from 'next/headers';
import { ArrowUpRight } from 'lucide-react';
import styles from './page.module.css';

export async function siteBase() {
  const host = (await headers()).get('host')?.split(':')[0].toLowerCase();
  return host === 'rpdata.net' || host === 'www.rpdata.net' ? '' : '/rpdata';
}
export const contactHref =
  'mailto:info@redistrictingpartners.com?subject=RP%20Data%20inquiry';
export function Contact() {
  return (
    <section className={styles.contact} id="contact">
      <div>
        <p className={styles.eyebrow}>Let’s work together</p>
        <h2>
          What are you trying
          <br />
          to understand?
        </h2>
      </div>
      <div>
        <p>
          A community. A changing population. A question in your data. Tell us
          what you’re working on, and we’ll help you find a path forward.
        </p>
        <a className={styles.lightButton} href={contactHref}>
          Start a conversation <ArrowUpRight size={18} />
        </a>
        <a className={styles.contactEmail} href={contactHref}>
          info@redistrictingpartners.com
        </a>
      </div>
    </section>
  );
}
export const services = [
  {
    id: 'census-data',
    number: '01',
    title: 'Census Data Consulting',
    summary: 'Understand the people behind the numbers.',
    description:
      'Make Census data useful for your organization. We help agencies and community partners understand population, demographic change, and the geographic patterns that shape their work.',
    items: [
      'Population and demographic profiles',
      'Census and American Community Survey data',
      'Research, interpretation, and clear reporting',
    ],
  },
  {
    id: 'census-outreach',
    number: '02',
    title: 'Census Outreach',
    summary: 'Reach the communities that need to be counted.',
    description:
      'Turn demographic research into an outreach plan. We help identify communities that may be missed, organize geographic priorities, and give local partners information they can use.',
    items: [
      'Community and audience mapping',
      'Outreach planning and partner support',
      'Tools to organize and evaluate engagement',
    ],
  },
  {
    id: 'gis',
    number: '03',
    title: 'GIS Services / Mapping',
    summary: 'Put your information in context.',
    description:
      'From boundary files to maps residents can use, we connect data to place. We create geographic analysis and maps that make complex information easier to explore and explain.',
    items: [
      'District and service-area mapping',
      'Geographic data preparation and analysis',
      'Interactive web maps and presentation maps',
    ],
  },
  {
    id: 'analysis',
    number: '04',
    title: 'Data Analysis',
    summary: 'Move from a spreadsheet to an answer.',
    description:
      'Bring a dataset, a research question, or a decision you need to make. We help organize the information, examine the patterns, and communicate what the results mean.',
    items: [
      'Data cleaning, integration, and review',
      'Demographic, survey, and geographic analysis',
      'Visualizations, reports, and decision support',
    ],
  },
  {
    id: 'my-district',
    number: '05',
    title: 'My District',
    summary: 'Connect residents with their representatives.',
    description:
      'An address lookup built for cities, counties, school districts, community colleges, and special districts. Residents find their district and elected officials; your team keeps the information current.',
    items: [
      'Four layouts with agency branding',
      'A hosted page or an embedded lookup',
      'Editable officials, photos, biographies, and contacts',
    ],
  },
];
