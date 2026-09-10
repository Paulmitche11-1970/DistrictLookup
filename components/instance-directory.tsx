import {
  ArrowRight,
  Building2,
  Landmark,
  GraduationCap,
  School,
  Waves,
  MapPin,
  Users,
} from 'lucide-react';
import type { Content } from '@/lib/model';
const categories = [
  { id: 'cities', name: 'Cities', singular: 'city', icon: Building2 },
  { id: 'counties', name: 'Counties', singular: 'county', icon: Landmark },
  {
    id: 'schools',
    name: 'School districts & boards of education',
    singular: 'school district',
    icon: School,
  },
  {
    id: 'colleges',
    name: 'Community college districts',
    singular: 'community college district',
    icon: GraduationCap,
  },
  {
    id: 'special',
    name: 'Special districts',
    singular: 'special district',
    icon: Waves,
  },
];
export default function InstanceDirectory({ content }: { content: Content }) {
  const members = content.officials.filter((o) => o.district !== null).length;
  return (
    <div className="instance-directory">
      <header className="instances-header">
        <a href="/" className="rp-gallery-brand">
          <span>RP</span> Redistricting Partners
        </a>
        <nav aria-label="Site navigation">
          <a href="#cities">Available agencies</a>
          <a
            href="https://redistrictingpartners.com"
            target="_blank"
            rel="noreferrer"
          >
            RP home <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      <main className="instances-main">
        <div className="instances-intro">
          <span className="eyebrow">REDISTRICTING PARTNERS</span>
          <h1>
            RP Data Voter
            <br />
            Lookup Instances
          </h1>
          <p>
            Find an agency, explore its districts, and connect with the people
            who represent you.
          </p>
          <span className="instance-availability">
            <span /> 1 agency available for review
          </span>
        </div>
        <nav className="instance-types" aria-label="Agency types">
          {categories.map((category) => (
            <a href={'#' + category.id} key={category.id}>
              <category.icon size={18} />
              <span>{category.name}</span>
              <small>{category.id === 'cities' ? 1 : 0}</small>
            </a>
          ))}
        </nav>
        <div className="instances-sections">
          {categories.map((category) => (
            <section
              className="instance-section"
              id={category.id}
              key={category.id}
              aria-labelledby={category.id + '-heading'}
            >
              <div className="instance-section-title">
                <category.icon size={22} />
                <h2 id={category.id + '-heading'}>{category.name}</h2>
                <span>
                  {category.id === 'cities' ? '1 available' : '0 available'}
                </span>
              </div>
              {category.id === 'cities' ? (
                <a className="agency-instance-card" href="/martinez">
                  <div className="agency-logo">
                    <img
                      src="/branding/martinez-logo.svg"
                      alt="City of Martinez, California"
                    />
                  </div>
                  <div className="agency-instance-content">
                    <span className="available-tag">
                      <span /> Available · Design review
                    </span>
                    <h3>City of Martinez</h3>
                    <p>California · Contra Costa County</p>
                    <div className="agency-instance-stats">
                      <span>
                        <MapPin size={16} /> {content.map.features.length}{' '}
                        council districts
                      </span>
                      <span>
                        <Users size={16} /> {members} district councilmembers
                      </span>
                    </div>
                    <div className="agency-instance-open">
                      4 lookup designs + administration preview{' '}
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </a>
              ) : (
                <div className="instance-empty">
                  No {category.singular} instances are published yet.
                </div>
              )}
            </section>
          ))}
        </div>
        <footer className="instances-footer">
          <span>Hosted by Redistricting Partners</span>
          <span>Agencies appear here when their lookup is available.</span>
        </footer>
      </main>
    </div>
  );
}
