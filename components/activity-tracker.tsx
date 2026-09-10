'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { activityContext } from '@/lib/activity-model';
import { trackActivity } from '@/lib/activity-client';

export function ActivityTracker() {
  const path = usePathname();
  const params = useSearchParams();
  const design = params.get('design') || '';
  const preview = params.get('preview') === '1';
  useEffect(() => {
    if (preview || !activityContext(path, design)) return;
    // Scheduling avoids duplicate events from React's development effect replay.
    const timer = setTimeout(() => trackActivity('page_view'), 0);
    function click(event: MouseEvent) {
      const element =
        event.target instanceof Element
          ? event.target.closest('a,button,[role="tab"]')
          : null;
      if (!element) return;
      if (element instanceof HTMLAnchorElement) {
        const destination = new URL(element.href, location.href);
        const label = (
          element.getAttribute('aria-label') ||
          element.textContent ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 160);
        if (destination.protocol === 'mailto:')
          trackActivity('email_click', { target: label });
        else if (destination.protocol === 'tel:')
          trackActivity('phone_click', { target: label });
        else if (/^https?:$/.test(destination.protocol)) {
          if (destination.origin !== location.origin)
            trackActivity('website_click', { target: destination.hostname });
          else if (destination.pathname.includes('/officials/'))
            trackActivity('biography_click', { target: label });
          else if (activityContext(destination.pathname))
            trackActivity('navigation_click', { target: destination.pathname });
        }
      } else {
        const label = (
          element.getAttribute('aria-label') ||
          element.textContent ||
          ''
        ).trim();
        if (
          [
            'Street',
            'Satellite',
            'Zoom in',
            'Zoom out',
            'Show all districts',
          ].includes(label)
        )
          trackActivity('map_control', { target: label });
      }
    }
    document.addEventListener('click', click);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', click);
    };
  }, [path, design, preview]);
  return null;
}
