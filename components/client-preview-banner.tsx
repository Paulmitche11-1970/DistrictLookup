'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Pencil } from 'lucide-react';
export function ClientPreviewBanner({
  agencyId,
  edited,
  revision,
  onReset,
}: {
  agencyId: string;
  edited: boolean;
  revision: number;
  onReset?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reset() {
    setBusy(true);
    setError('');
    try {
      const result = await fetch(`/api/previews/${agencyId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      });
      if (!result.ok)
        throw Error(
          (await result.json()).error || 'Could not restore the default.',
        );
      setConfirm(false);
      if (onReset) await onReset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className="client-preview-banner"
      aria-label="Agency preview controls"
    >
      <div>
        <strong>{edited ? 'Edited preview' : 'Prepared default'}</strong>
        <p>
          {edited
            ? 'Your agency’s saved edits appear in all four layouts.'
            : 'Try the editor to customize your agency’s preview.'}{' '}
          Changes here stay in this shared preview.
        </p>
      </div>
      <div className="client-preview-actions">
        <a className="btn" href={`/${agencyId}/administration`}>
          <Pencil size={15} /> Try the editor
        </a>
        <button
          className="btn"
          disabled={!edited || busy}
          onClick={() => setConfirm(true)}
        >
          <RotateCcw size={15} /> Return to default
        </button>
        <button
          className="btn quiet"
          disabled={busy}
          onClick={async () => {
            const r = await fetch(`/api/previews/${agencyId}/logout`, {
              method: 'POST',
            });
            if (r.ok) location.assign(`/preview/${agencyId}`);
            else setError('Could not sign out. Try again.');
          }}
        >
          Sign out
        </button>
      </div>
      {confirm && (
        <div className="client-preview-confirm" role="alert">
          <p>
            Return all four layouts to the version prepared by RP? This removes
            your team’s saved preview edits, including text, photos, settings
            and map changes.
          </p>
          <button className="btn primary" disabled={busy} onClick={reset}>
            {busy ? 'Restoring…' : 'Restore prepared default'}
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep editing
          </button>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
