import { reviewDestination } from '@/lib/review-destination';
import { LockKeyhole } from 'lucide-react';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review access | RP Data' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = params.scope === 'rp' ? 'rp' : 'martinez';
  const next = reviewDestination(scope, params.next);
  return (
    <main className="review-access-page">
      <form
        action="/api/review"
        method="post"
        className="review-access-card stack"
      >
        <span className="eyebrow">RP DATA · PRIVATE REVIEW</span>
        <LockKeyhole size={30} />
        <h1>
          {scope === 'rp' ? 'Your agency workspace' : 'Martinez design review'}
        </h1>
        <p className="muted">
          {scope === 'rp'
            ? 'Enter the RP team password to open your agency workspace.'
            : 'Enter your review password to explore the four designs and administration preview.'}
        </p>
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="next" value={next} />
        <label className="field">
          Review password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            maxLength={128}
          />
        </label>
        {params.error && (
          <p className="notice error" role="alert">
            {params.error === 'limited'
              ? 'Too many attempts. Please try again in 15 minutes.'
              : params.error === 'unavailable'
                ? 'Review access is being configured. Please try again shortly.'
                : 'That password was not recognized. Please try again.'}
          </p>
        )}
        <button className="btn primary" type="submit">
          Open workspace
        </button>
        <a href="/admin" className="small">
          Agency administrator sign in
        </a>
      </form>
    </main>
  );
}
