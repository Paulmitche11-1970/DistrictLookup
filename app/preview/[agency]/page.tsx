import { notFound, redirect } from 'next/navigation';
import { instanceFor } from '@/lib/instances';
import { hasClientPreviewAccess } from '@/lib/client-preview-access';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Agency preview | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ agency: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const instance = instanceFor((await params).agency);
  if (!instance) notFound();
  if (await hasClientPreviewAccess(instance.id)) redirect('/' + instance.id);
  const { error } = await searchParams;
  return (
    <main className="client-preview-login">
      <section>
        <a className="rp-gallery-brand" href="https://rpdata.net">
          <span>RP</span> RP Data
        </a>
        <img src={instance.logo} alt={instance.name} />
        <p className="eyebrow">YOUR AGENCY PREVIEW</p>
        <h1>{instance.name}</h1>
        <p>
          Explore four designs and try the editor. Your team can change text,
          photos and settings, then return to our prepared default at any time.
        </p>
        <form action={'/api/previews/' + instance.id + '/login'} method="post">
          <label htmlFor="preview-password">Preview password</label>
          <input
            id="preview-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          {error && (
            <p role="alert" className="notice error">
              {error === 'limited'
                ? 'Too many attempts. Please wait 15 minutes before trying again.'
                : 'That password was not recognized. Please try again.'}
            </p>
          )}
          <button className="btn primary" type="submit">
            Open agency preview →
          </button>
        </form>
        <p className="small muted">
          Use the password supplied by Redistricting Partners. Changes are
          shared with your agency’s preview team.
        </p>
      </section>
    </main>
  );
}
