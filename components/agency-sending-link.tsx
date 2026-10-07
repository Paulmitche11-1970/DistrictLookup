'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ArrowUpRight } from 'lucide-react';
import styles from './agency-sending-link.module.css';

export function AgencySendingLink({
  path,
  password,
}: {
  path: string;
  password?: string;
}) {
  const [url, setUrl] = useState(path);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const link = new URL(path, window.location.origin);
    link.searchParams.set('utm_source', 'rp_outreach');
    link.searchParams.set('utm_medium', 'email');
    link.searchParams.set(
      'utm_campaign',
      path.split('/').filter(Boolean).at(-1) || 'agency-preview',
    );
    setUrl(link.href);
  }, [path]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Sending link copied.');
    } catch {
      setMessage('Select and copy the link below.');
    }
  }
  return (
    <section className={styles.box} aria-label="Agency sending link">
      <strong>Sending Link</strong>
      <p>
        Opens this agency’s designs and editable preview. Send the preview
        password with this link. The link includes an outreach tag so visits can
        be measured in RP administration.
      </p>
      <input
        aria-label="Sending Link"
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
      {password && (
        <p>
          Preview password: <code>{password}</code>
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" onClick={copy} className="btn">
          {message === 'Sending link copied.' ? (
            <Check size={15} />
          ) : (
            <Copy size={15} />
          )}{' '}
          Copy link
        </button>
        <a href={path} target="_blank" rel="noreferrer">
          Open preview <ArrowUpRight size={15} />
        </a>
      </div>
      <span className="small" role="status">
        {message}
      </span>
    </section>
  );
}
