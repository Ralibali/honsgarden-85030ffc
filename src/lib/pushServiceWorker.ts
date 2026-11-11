import { PUSH_SW_URL, isPwaRegistrationDisabled } from '@/lib/pwaUpdate';

/**
 * Service worker för web push.
 *
 * Appen har ingen cachande service worker längre, så push-workern måste
 * registreras uttryckligen. Utan en registrering löser sig
 * `navigator.serviceWorker.ready` aldrig, och den som slår på notiser blir
 * stående med en inaktiv knapp.
 */

const ACTIVATION_TIMEOUT_MS = 10_000;

function waitUntilActive(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onChange);
      if (error) reject(error);
      else resolve();
    };
    const onChange = () => {
      if (worker.state === 'activated') done();
      else if (worker.state === 'redundant') done(new Error('Push-workern kunde inte installeras.'));
    };
    const timer = setTimeout(() => done(new Error('Push-workern startade inte i tid.')), timeoutMs);
    worker.addEventListener('statechange', onChange);
    onChange();
  });
}

/** Registrerar push-workern om den saknas och väntar tills den går att prenumerera med. */
export async function ensurePushRegistration(
  timeoutMs = ACTIVATION_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration> {
  if (isPwaRegistrationDisabled()) {
    throw new Error('Notiser går bara att slå på i den publicerade appen.');
  }
  // updateViaCache: 'none' gör att en ny version av workern alltid hämtas från nätet.
  const registration = await navigator.serviceWorker.register(PUSH_SW_URL, {
    scope: '/',
    updateViaCache: 'none',
  });
  if (registration.active) return registration;

  const pending = registration.installing ?? registration.waiting;
  if (!pending) throw new Error('Push-workern kunde inte installeras.');
  await waitUntilActive(pending, timeoutMs);
  return registration;
}

/** Den här webbläsarens push-prenumeration, utan att registrera något. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}
