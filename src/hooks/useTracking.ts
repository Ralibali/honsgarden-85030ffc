import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const COOKIE_CONSENT_KEY = 'cookie-consent';

function hasTrackingConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('_track_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('_track_sid', sid);
  }
  return sid;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    if (!hasTrackingConsent()) return;

    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;

    const sessionId = getSessionId();

    supabase.from('page_views').insert({
      path,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: sessionId,
      device_type: getDeviceType(),
    } as any).then(() => {}, () => {});
  }, [location.pathname]);
}

export function trackClick(eventName: string, opts?: {
  elementId?: string;
  elementText?: string;
  metadata?: Record<string, any>;
}) {
  if (!hasTrackingConsent()) return;

  const sessionId = getSessionId();
  supabase.from('click_events').insert({
    event_name: eventName,
    element_id: opts?.elementId,
    element_text: opts?.elementText,
    path: window.location.pathname,
    session_id: sessionId,
    metadata: opts?.metadata || {},
  } as any).then(() => {}, () => {});
}

// CTA keywords to auto-detect
const CTA_KEYWORDS = [
  'kom igång', 'skapa ett konto', 'skapa konto', 'registrera', 'logga in',
  'uppgradera', 'köp', 'testa gratis', 'prova', 'ladda ner', 'boka',
  'prenumerera', 'läs mer', 'visa mer', 'börja nu', 'starta',
];

const TRACKED_ROLES = ['button', 'link', 'menuitem'];

/**
 * Auto-tracks clicks on buttons, links and CTAs via event delegation.
 * No need to manually add trackClick to each component.
 */
export function useAutoClickTracking() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!hasTrackingConsent()) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      // Walk up to find the clickable element (button, a, [role=button])
      let el: HTMLElement | null = target;
      let depth = 0;
      while (el && depth < 6) {
        const tag = el.tagName?.toLowerCase();
        const role = el.getAttribute('role');
        if (
          tag === 'button' ||
          tag === 'a' ||
          (role && TRACKED_ROLES.includes(role))
        ) {
          break;
        }
        el = el.parentElement;
        depth++;
      }

      if (!el || depth >= 6) return;

      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().substring(0, 80);
      const textLower = text.toLowerCase();

      // Skip trivial/nav clicks with very short text
      if (!text || text.length < 2) return;

      // Determine event name
      let eventName = 'click';
      const href = el.getAttribute('href') || '';

      // Check if it's a CTA
      const isCta = CTA_KEYWORDS.some(kw => textLower.includes(kw));
      if (isCta) {
        eventName = 'cta_click';
      } else if (tag === 'a' && href.startsWith('/blogg/')) {
        eventName = 'blog_link_click';
      } else if (tag === 'a' && (href.startsWith('http') || href.startsWith('//'))) {
        eventName = 'external_link_click';
      } else if (tag === 'a') {
        eventName = 'nav_click';
      } else {
        eventName = 'button_click';
      }

      trackClick(eventName, {
        elementId: el.id || el.getAttribute('data-track') || undefined,
        elementText: text,
        metadata: {
          tag,
          href: href || undefined,
          isCta,
        },
      });
    };

    document.addEventListener('click', handler, { passive: true, capture: true });
    return () => document.removeEventListener('click', handler, true);
  }, []);
}
