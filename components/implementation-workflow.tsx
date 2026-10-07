'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  implementationStatuses,
  billingStatuses,
} from '@/lib/implementation-model';
import type { ImplementationRequest } from '@/lib/implementation-store';
export function ImplementationWorkflow({
  request: r,
}: {
  request: ImplementationRequest;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/implementation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          id: r.id,
          version: r.version,
        }),
      });
      if (!response.ok)
        throw Error((await response.json()).error || 'Could not save.');
      setMessage('Workflow updated.');
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="outreach-form no-print" key={r.version}>
      <div className="implementation-grid">
        <label className="field">
          Implementation status
          <select name="status" defaultValue={r.status}>
            {implementationStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          RP owner
          <input name="owner" defaultValue={r.owner} maxLength={150} />
        </label>
        <label className="field">
          Actual service start
          <input
            type="date"
            name="serviceStart"
            defaultValue={r.serviceStart}
          />
        </label>
        <label className="field">
          First invoice status
          <select name="billingStatus" defaultValue={r.billingStatus}>
            {billingStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        External invoice reference
        <input
          name="invoiceReference"
          defaultValue={r.invoiceReference}
          maxLength={200}
          placeholder="Reference from your billing system"
        />
      </label>
      <p className="small">
        Mark issued or paid only after handling the invoice in your billing
        system. The service must be live and the free period complete. This page
        does not send invoices or charge cards. When cancelling an unused
        request, also void its invoice draft.
      </p>
      <label className="field">
        Internal note
        <textarea name="note" maxLength={2000} rows={3} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save workflow'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
