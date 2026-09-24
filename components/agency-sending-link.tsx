'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ArrowUpRight } from 'lucide-react';
import styles from './agency-sending-link.module.css';

export function AgencySendingLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setUrl(new URL(path, window.location.origin).href);
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
        Opens only this agency’s designs and read-only administration preview.
        No login needed.
      </p>
      <input
        aria-label="Sending Link"
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
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
