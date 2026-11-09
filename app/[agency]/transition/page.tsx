import { notFound, redirect } from 'next/navigation';
import { inAgency } from '@/lib/agency-scope';
import { inClientPreview } from '@/lib/client-preview-scope';
import { instanceFor } from '@/lib/instances';
import { hasTransitionAccess } from '@/lib/transition-access';
import {
  transition,
  transitionContent,
  transitionReadiness,
} from '@/lib/board-transition';
import { visibleContent } from '@/lib/store';
import { designs } from '@/lib/designs';
import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import { OfficialBiographyPage } from '@/components/official-biography-page';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Incoming board | Private staff preview',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
type Props = {
  params: Promise<{ agency: string }>;
  searchParams: Promise<{
    key?: string;
    demo?: string;
    design?: string;
    official?: string;
  }>;
};
export default async function Page({ params, searchParams }: Props) {
  const { agency } = await params;
  const query = await searchParams;
  if (instanceFor(agency)?.id !== agency) notFound();
  const demo = query.demo === '1';
  if (query.key)
    redirect(
      `/api/transitions/${agency}/access?key=${encodeURIComponent(query.key)}${demo ? '&demo=1' : ''}`,
    );
  const render = async () => {
    if (!(await hasTransitionAccess()))
      return (
        <main className="transition-unavailable panel">
          <h1>Private board preview</h1>
          <p>
            Open the staff preview link provided by your agency administrator.
            If an earlier link no longer works, the preview may have launched or
            its sharing link may have been replaced.
          </p>
        </main>
      );
    const incoming = transition();
    if (!incoming)
      return (
        <main className="transition-unavailable panel">
          <h1>This transition preview has closed</h1>
          <p>
            The incoming board may have launched, or the transition was removed.
          </p>
        </main>
      );
    const prepared = transitionContent();
    const issue = transitionReadiness(prepared);
    const content = visibleContent(prepared);
    const base = `/${agency}/transition${demo ? '?demo=1' : ''}`;
    content.agency.boardTransition = {
      path: base,
      api: `/api/transitions/${agency}`,
      demo,
    };
    const design = designs.find((d) => d.id === query.design)?.id || 'classic';
    const view = query.official ? (
      await OfficialBiographyPage({
        agencyId: agency,
        officialId: query.official,
        preview: true,
        design,
        preparedContent: content,
        returnPath: base + (demo ? '&' : '?') + 'design=' + design,
      })
    ) : design === 'classic' ? (
      <Lookup content={content} preview />
    ) : (
      <LookupVariant content={content} design={design} preview />
    );
    return (
      <div className="transition-preview">
        <section
          className="transition-preview-bar"
          aria-label="Incoming board preview"
        >
          <div>
            <strong>{incoming.title} · Private staff preview</strong>
            <p>
              {demo ? 'Agency demonstration preview. ' : ''}This board is not
              live.{' '}
              {incoming.swearingIn
                ? `Planned swearing-in: ${incoming.swearingIn}. `
                : ''}
              Only an administrator can launch it.
            </p>
            {issue && (
              <p>
                District assignments are still being prepared. This preview is
                incomplete.
              </p>
            )}
          </div>
          <nav aria-label="Preview layouts">
            {designs.map((d) => (
              <a
                key={d.id}
                href={base + (demo ? '&' : '?') + 'design=' + d.id}
                aria-current={
                  !query.official && design === d.id ? 'page' : undefined
                }
              >
                {d.name}
              </a>
            ))}
          </nav>
        </section>
        {view}
      </div>
    );
  };
  return inAgency(agency, () => (demo ? inClientPreview(render) : render()));
}
