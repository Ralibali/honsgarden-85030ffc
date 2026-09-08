import type { DigitalProductSlug } from './digitalProducts';
import './analytics';

/** A valid download link was issued, not proof the browser saved the whole file. */
export function trackPaidPdfDownload(product: DigitalProductSlug, source: 'thank_you' | 'email_link'): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
      resolve();
      return;
    }
    // Never let blocked analytics stop delivery, or send order tokens/signed URLs.
    const timer = window.setTimeout(resolve, 750);
    const done = () => { window.clearTimeout(timer); resolve(); };
    try {
      window.plausible('Paid PDF Download', {
        props: { product, source },
        url: window.location.origin + window.location.pathname,
        callback: done,
      });
    } catch {
      done();
    }
  });
}
