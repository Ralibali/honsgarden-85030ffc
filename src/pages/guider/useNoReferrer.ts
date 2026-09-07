import { useEffect } from 'react';

/** Sätter no-referrer på privata leveranssidor så att tokens inte läcker vidare. */
export function useNoReferrer() {
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const created = !el;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'referrer');
      document.head.appendChild(el);
    }
    const previous = el.getAttribute('content');
    el.setAttribute('content', 'no-referrer');
    return () => {
      if (created) el?.remove();
      else if (previous) el?.setAttribute('content', previous);
    };
  }, []);
}
