/**
 * Enkelt klientfel-loggningsverktyg.
 *
 * - Alla fel loggas ALLTID till console (med strukturerad payload)
 * - Senaste 50 felen sparas i localStorage (`__honsgarden_error_log`) som
 *   ringbuffer för debugging – den kan kopieras ut av support/admin
 * - Om edge-funktionen `log-client-error` finns POSTas felet dit asynkront
 *   (best-effort, 2s timeout, tysta fel om den saknas eller returnerar 404)
 * - Respekterar cookie-consent: skickar ingenting till servern utan accept
 *
 * För att aktivera server-side-loggning, skapa en Supabase edge-funktion
 * `log-client-error` som tar emot body `{ level, message, stack, url, ua,
 * userId?, buildTime, context }` och skriver till en `client_error_logs`-tabell.
 */

import { supabase } from '@/integrations/supabase/client';

const LS_KEY = '__honsgarden_error_log';
const MAX_ENTRIES = 50;
const CONSENT_KEY = 'cookie-consent';
const FN_TIMEOUT_MS = 2000;

export type ErrorLevel = 'error' | 'warning' | 'info';

export interface ErrorPayload {
  level: ErrorLevel;
  message: string;
  stack?: string;
  url?: string;
  ua?: string;
  userId?: string | null;
  buildTime?: string;
  context?: Record<string, unknown>;
  ts: string;
}

function hasServerLogConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

function pushToLocalBuffer(entry: ErrorPayload) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list: ErrorPayload[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* quota / privacy mode – tyst */
  }
}

async function postToServer(entry: ErrorPayload): Promise<void> {
  if (!hasServerLogConsent()) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FN_TIMEOUT_MS);
    // Anropa edge-funktionen via supabase-sdk. Om den inte finns returneras
    // 404 som error – vi ignorerar tyst.
    await supabase.functions.invoke('log-client-error', {
      body: entry,
    });
    clearTimeout(timeout);
  } catch {
    /* best-effort – inget läcker ut till användaren */
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Loggar ett klientfel. Kan anropas från ErrorBoundary, globala handlers
 * eller från specifika try/catch-block där extra kontext finns.
 */
export async function logClientError(
  error: unknown,
  options: { level?: ErrorLevel; context?: Record<string, unknown> } = {},
): Promise<void> {
  const { level = 'error', context } = options;
  const err = error instanceof Error ? error : new Error(String(error));

  const payload: ErrorPayload = {
    level,
    message: err.message,
    stack: err.stack,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : undefined,
    context,
    ts: new Date().toISOString(),
    userId: await getCurrentUserId(),
  };

  // 1. Alltid console för utvecklare
  const logFn = level === 'warning' ? console.warn : level === 'info' ? console.info : console.error;
  logFn(`[honsgarden:${level}]`, payload.message, payload);

  // 2. Ringbuffer i localStorage
  pushToLocalBuffer(payload);

  // 3. Server (best-effort, inget await från anroparen)
  void postToServer(payload);
}

/**
 * Installera globala handlers för oinfångade fel och promise-rejections.
 * Anropas en gång i app-entry.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    // Ignorera resursfel (img/script 404) – dessa stör mer än de hjälper
    if (event.target && event.target !== window) return;
    void logClientError(event.error ?? new Error(event.message), {
      level: 'error',
      context: {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    void logClientError(reason ?? new Error('Unhandled promise rejection'), {
      level: 'error',
      context: { source: 'unhandledrejection' },
    });
  });
}

/**
 * Läser senaste felen från ringbuffern (för debug/support-vyer).
 */
export function getStoredErrorLog(): ErrorPayload[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ErrorPayload[]) : [];
  } catch {
    return [];
  }
}

/**
 * Rensar ringbuffern.
 */
export function clearStoredErrorLog() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignorera */
  }
}
