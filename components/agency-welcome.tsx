'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Globe, LayoutGrid, Pencil, X } from 'lucide-react';
import styles from './agency-welcome.module.css';

/** The introduction belongs to the agency design review, not residents' lookups. */
export function AgencyWelcome({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = `rp-agency-welcome-2026-09-v1:${id}`;
  useEffect(() => {
    const element = dialog.current;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(storageKey) === 'seen';
    } catch {
      // A blocked storage API should never prevent access to the designs.
    }
    if (!dismissed && !element?.open) element?.showModal();
    return () => element?.close();
  }, [storageKey]);
  function remember() {
    try {
      sessionStorage.setItem(storageKey, 'seen');
    } catch {
      // The dialog remains fully usable when storage is unavailable.
    }
  }
  return (
    <div className={styles.introduction}>
      <button
        className={styles.reopen}
        onClick={() => dialog.current?.showModal()}
      >
        About your agency lookup <ArrowRight size={16} />
      </button>
      <dialog
        ref={dialog}
        data-agency-welcome
        className={styles.dialog}
        aria-labelledby="agency-welcome-title"
        onClose={remember}
      >
        <button
          className={styles.close}
          aria-label="Close introduction"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            Redistricting Partners · Agency preview
          </p>
          <h2 id="agency-welcome-title">
            Help residents find their representatives.
          </h2>
          <p className={styles.lead}>
            Explore a public mapping tool prepared for {name}. Residents can
            look up an address, see their district, and connect with the people
            who represent them.
          </p>
          <div className={styles.features}>
            <div>
              <Globe size={23} />
              <section>
                <h3>Fits into your website</h3>
                <p>
                  Link from your agency website to the page hosted by RP, or
                  embed the lookup directly in your website. We can provide the
                  link and embed code.
                </p>
              </section>
            </div>
            <div>
              <Pencil size={23} />
              <section>
                <h3>Your information, your controls</h3>
                <p>
                  In the protected administration workspace, update elected
                  officials’ names, photos, biographies, and contact
                  information. Choose which details residents see, then publish
                  your changes across all four layouts.
                </p>
              </section>
            </div>
            <div>
              <LayoutGrid size={23} />
              <section>
                <h3>Four layouts to try</h3>
                <p>
                  Compare Classic, Concierge, Explorer, and Presentation. Have a
                  feature request or a change in mind? We’d like to hear it and
                  explore changes to meet your agency’s needs.
                </p>
              </section>
            </div>
          </div>
          <div className={styles.offer}>
            <strong>Free until July 1, 2027</strong>
            <p>
              Beginning July 1, 2027, the service is billed at{' '}
              <b>$75 per month</b> or <b>$900 per year</b>.
            </p>
          </div>
          <button
            className={styles.continue}
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Explore the four layouts <ArrowRight size={18} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
