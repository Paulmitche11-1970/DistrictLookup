import { ArrowUpRight } from 'lucide-react';
import { Contact } from '../site';
import styles from '../page.module.css';
export const metadata = {
  title: 'About Us',
  description:
    'Meet Paul Mitchell, Jacob Thompson Fisher, Chris Chaffee, and Liz Stitt—the people behind RP Data.',
  alternates: { canonical: 'https://rpdata.net/about' },
};
const team = [
  {
    name: 'Paul Mitchell',
    focus: 'Leadership · Data & analysis',
    image: 'paul.jpg',
    bio: 'Paul leads RP Data. He is the owner of Redistricting Partners and Vice President of Political Data, bringing experience in demographics, redistricting, polling, and survey research. His work spans states, cities, counties, school boards, and community college districts, as well as nonprofit organizations working on elections and community engagement.',
    detail:
      'Paul holds a Master of Public Policy from the University of Southern California, an undergraduate degree from American University, and an associate degree from Orange Coast College.',
    source: 'https://redistrictingpartners.com/about/',
    sourceLabel: 'Redistricting Partners profile',
  },
  {
    name: 'Jacob Thompson Fisher',
    focus: 'Data · Mapping',
    image: 'jacob.png',
    bio: 'Jacob is part of the RP Data team and contributes to the mapping work of Redistricting Partners. His published projects include interactive district maps for the City of Napa and San Juan Water District, helping people explore proposed boundaries and compare different plans.',
    detail:
      'His work connects geographic information with tools that make district maps easier to use and share.',
    source: 'https://redistrictingpartners.com/2020/',
    sourceLabel: 'Mapping projects at Redistricting Partners',
  },
  {
    name: 'Chris Chaffee',
    focus: 'Outreach · Strategy',
    image: 'chris.png',
    bio: 'Chris brings more than two decades of experience in policy, data management, campaigns, and community outreach. As a former Chief Operating Officer of Redistricting Partners, he helped guide local agencies through the 2020 redistricting cycle.',
    detail:
      'His experience includes developing systems that organize outreach, track engagement, and help organizations use data to make decisions. He brings that practical connection between information and community participation to the team.',
    source:
      'https://socalgrantmakers.org/events/event-calendar/understanding-luca-process-and-how-it-impacts-accurate-2030-census',
    sourceLabel: 'Professional biography',
  },
  {
    name: 'Liz Stitt',
    focus: 'Public policy · Redistricting',
    image: 'liz.jpg',
    bio: 'Elizabeth “Liz” Stitt is the Administrative Program Coordinator at the University of Texas at Austin’s Center for Law and Democracy. Previously, she served as Chief Administrative Officer and Senior Line Drawer at Redistricting Partners, leading municipal redistricting projects and helping draw California’s 2025 congressional districts.',
    detail:
      'Liz has also worked in the California and Texas legislatures. She earned a Master in Public Affairs from UT Austin’s LBJ School and bachelor’s degrees in international relations and political science from UC Davis.',
    source:
      'https://liberalarts.utexas.edu/lawanddemocracy/researchers/eas4477',
    sourceLabel: 'UT Austin profile',
  },
];
export default function Page() {
  return (
    <>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>About us</p>
        <h1>
          People who see
          <br />
          <em>the bigger picture.</em>
        </h1>
        <p className={styles.lead}>
          RP Data brings the data and analysis work of Redistricting Partners
          together with related projects, public tools, and a team that
          understands communities.
        </p>
      </section>
      <section className={styles.teamGrid} aria-label="Our team">
        {team.map((person) => (
          <article key={person.name} className={styles.person}>
            <div className={styles.portrait}>
              <img
                src={`/rpdata/team/${person.image}`}
                alt={person.name}
                width={600}
                height={600}
                loading="lazy"
              />
            </div>
            <div className={styles.personText}>
              <p className={styles.eyebrow}>{person.focus}</p>
              <h2>{person.name}</h2>
              <p>{person.bio}</p>
              <p>{person.detail}</p>
              <a className={styles.textLink} href={person.source}>
                {person.sourceLabel} <ArrowUpRight size={15} />
              </a>
            </div>
          </article>
        ))}
      </section>
      <section className={styles.relationship}>
        <p className={styles.eyebrow}>Shared roots. A broader view.</p>
        <h2>
          Built on the work of
          <br />
          Redistricting Partners.
        </h2>
        <p>
          RP Data extends that work into Census consulting, outreach, geographic
          analysis, and public information tools. For redistricting services and
          more about the firm, visit{' '}
          <a href="https://redistrictingpartners.com/">
            Redistricting Partners
          </a>
          .
        </p>
      </section>
      <Contact />
    </>
  );
}
