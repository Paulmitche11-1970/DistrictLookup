import { requireReviewAccess } from '@/lib/review-access';
import { inArpeeville } from '@/lib/agency-scope';
import { publicContent } from '@/lib/store';
import { designs } from '@/lib/designs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Arpeeville test workspace | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page() {
  await requireReviewAccess('rp', '/arpeeville');
  const content = inArpeeville(publicContent);
  const mayor = content.officials.find((o) => o.district === null);
  return (
    <main className="sandbox-home">
      <nav className="row">
        <a href="/">← All agencies</a>
        <span className="pill">FICTIONAL TEST AGENCY</span>
      </nav>
      <section className="sandbox-hero">
        <div>
          <span className="eyebrow">RP DATA · THE TEST CITY</span>
          <h1>
            Welcome to
            <br />
            Arpeeville.
          </h1>
          <p>A little San Mateo. A little Foster City. A council you know.</p>
          <p className="muted">
            Try the resident experience, edit the council, and publish changes
            to this test agency.
          </p>
          <div className="row">
            <a className="btn primary" href="/arpeeville/lookup">
              Open the lookup →
            </a>
            <a className="btn" href="/arpeeville/administration">
              Open administration
            </a>
          </div>
        </div>
        <div className="sandbox-mayor">
          {mayor?.photo && <img src={mayor.photo} alt={mayor.name} />}
          <span className="eyebrow">
            {mayor ? 'YOUR TEST CITY MAYOR' : 'YOUR TEST CITY'}
          </span>
          <h2>
            {mayor ? (mayor.vacant ? 'Vacant seat' : mayor.name) : 'Arpeeville'}
          </h2>
          <span>{content.map.features.length} council districts</span>
        </div>
      </section>
      <section>
        <span className="eyebrow">YOUR TEST DRIVE</span>
        <h2>Make a change. See it live.</h2>
        <div className="sandbox-steps">
          <article>
            <strong>01 · Find a district</strong>
            <p>
              Search “100 Democracy Way,” or browse a councilmember. All 25
              address entries are fictional test locations.
            </p>
          </article>
          <article>
            <strong>02 · Make it yours</strong>
            <p>
              Upload a photo, edit a phone number, change a display option or
              try a new district map.
            </p>
          </article>
          <article>
            <strong>03 · Preview & publish</strong>
            <p>
              Drafts stay private until published. The Arpeeville lookup and
              embed use your published design and details.
            </p>
          </article>
        </div>
      </section>
      <section>
        <h2>Meet the council</h2>
        <div className="sandbox-roster">
          {content.officials
            .filter((o) => o.district !== null)
            .map((o) => (
              <a href="/arpeeville/council" key={o.id}>
                {o.photo ? (
                  <img src={o.photo} alt={o.name} />
                ) : (
                  <span className="sandbox-initials">
                    {o.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                )}
                <strong>{o.name}</strong>
                <span>
                  {o.title} · District {o.district}
                </span>
              </a>
            ))}
        </div>
      </section>
      <section>
        <h2>Try all four designs</h2>
        <div className="sandbox-steps">
          {designs.map((d) => (
            <a
              className="sandbox-design"
              key={d.id}
              href={d.path.replace('/martinez', '/arpeeville')}
            >
              <span className="eyebrow">OPTION {d.number}</span>
              <h3>{d.name}</h3>
              <span>Open this design →</span>
            </a>
          ))}
        </div>
      </section>
      <footer>
        <strong>For demonstration only.</strong> These offices, contacts,
        addresses, and combined geography are fictional. Arpeeville edits are
        stored separately from Martinez.{' '}
        <a href="/arpeeville/administration">Open test administration</a>
      </footer>
    </main>
  );
}
