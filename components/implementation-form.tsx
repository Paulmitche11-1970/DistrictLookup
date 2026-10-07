'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { designs } from '@/lib/designs';
import type { serviceOffer } from '@/lib/service-offer';
export function ImplementationForm({
  agency,
  revision,
  offer,
  initialLayout,
}: {
  agency: string;
  revision: number;
  offer: ReturnType<typeof serviceOffer>;
  initialLayout: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState('');
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      const result = await fetch('/api/implementation/' + agency, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(data),
          requestKey: key,
          revision,
          offerVersion: offer.version,
          authorized: data.get('authorized') === 'on',
          pricingAccepted: data.get('pricingAccepted') === 'on',
        }),
      });
      if (!result.ok)
        throw new Error(
          (await result.json()).error || 'Unable to submit. Please try again.',
        );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="implementation-form" onSubmit={submit}>
      <fieldset className="implementation-card">
        <legend>1 · Choose your experience</legend>
        <label className="field">
          Preferred layout
          <select name="layout" defaultValue={initialLayout}>
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          How would you like to use it?
          <select name="delivery" defaultValue="both">
            <option value="both">
              Both an embed code and a dedicated link
            </option>
            <option value="embed">Embedded in our website</option>
            <option value="hosted">A dedicated link hosted by RP</option>
            <option value="help">Help us decide</option>
          </select>
        </label>
        <label className="field">
          Agency website
          <input
            type="url"
            name="website"
            maxLength={500}
            placeholder="https://"
          />
        </label>
        <label className="field">
          Adjustments, timing, or features you’d like
          <textarea name="notes" rows={4} maxLength={4000} />
        </label>
        <p className="small muted">
          We’ll save a copy of your current preview (revision {revision}) with
          this request so your choices are clear.
        </p>
      </fieldset>
      <fieldset className="implementation-card">
        <legend>2 · Who should we work with?</legend>
        <div className="implementation-grid">
          <label className="field">
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={150}
            />
          </label>
          <label className="field">
            Your title
            <input
              name="title"
              autoComplete="organization-title"
              required
              minLength={2}
              maxLength={150}
            />
          </label>
          <label className="field">
            Work email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={250}
            />
          </label>
          <label className="field">
            Phone (optional)
            <input name="phone" autoComplete="tel" maxLength={80} />
          </label>
        </div>
      </fieldset>
      <fieldset className="implementation-card">
        <legend>3 · Service and billing</legend>
        <div className="implementation-offer">
          <h2>{offer.headline}</h2>
          <p>
            {offer.description} Beginning {offer.billingLabel}, the basic
            service is $75 per month or $900 per year.
          </p>
        </div>
        <label className="field">
          Billing preference after the free period
          <select name="frequency" defaultValue="annual">
            <option value="annual">$900 per year</option>
            <option value="monthly">$75 per month</option>
          </select>
        </label>
        <div className="implementation-grid">
          <label className="field">
            Billing contact or department
            <input name="billingName" required minLength={2} maxLength={200} />
          </label>
          <label className="field">
            Billing email
            <input name="billingEmail" type="email" required maxLength={250} />
          </label>
        </div>
        <label className="field">
          Billing address / purchase order instructions (optional)
          <textarea name="billingAddress" rows={3} maxLength={1000} />
        </label>
        <p>
          No payment is collected now. This creates an implementation request
          and a future invoice draft for RP to review. We’ll coordinate launch,
          procurement requirements, and billing with your team.
        </p>
        <label className="implementation-check">
          <input name="authorized" type="checkbox" required /> I am authorized
          to request implementation for this agency.
        </label>
        <label className="implementation-check">
          <input name="pricingAccepted" type="checkbox" required /> I have
          reviewed the free period and pricing above and would like RP to move
          forward with implementation.
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Confirm selection & request implementation'}
      </button>
    </form>
  );
}
