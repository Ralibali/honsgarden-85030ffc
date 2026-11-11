import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPushSubscription, ensurePushRegistration } from '@/lib/pushServiceWorker';
import { isPushOnlyRegistration, recoverStalePwaShell } from '@/lib/pwaUpdate';
import { clearBrowserAppCaches } from '@/lib/cacheRefresh';

/** En service worker som går att flytta mellan tillstånd, som i webbläsaren. */
function fakeWorker(scriptURL: string, state: ServiceWorkerState) {
  const listeners = new Set<() => void>();
  const worker = {
    scriptURL,
    state,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    become(next: ServiceWorkerState) { worker.state = next; [...listeners].forEach((fn) => fn()); },
    listenerCount: () => listeners.size,
  };
  return worker;
}

function fakeRegistration(parts: { active?: unknown; waiting?: unknown; installing?: unknown } = {}) {
  return {
    active: null, waiting: null, installing: null, ...parts,
    unregister: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(undefined),
    pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
  };
}

const origin = 'https://honsgarden.se';
let container: {
  register: ReturnType<typeof vi.fn>;
  getRegistration: ReturnType<typeof vi.fn>;
  getRegistrations: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  container = { register: vi.fn(), getRegistration: vi.fn(), getRegistrations: vi.fn().mockResolvedValue([]) };
  vi.stubGlobal('navigator', { serviceWorker: container, userAgent: 'test' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('ensurePushRegistration', () => {
  it('registrerar push-workern på rot-scope och hämtar den aldrig ur HTTP-cachen', async () => {
    const registration = fakeRegistration({ active: fakeWorker(`${origin}/push-sw.js`, 'activated') });
    container.register.mockResolvedValue(registration);

    await expect(ensurePushRegistration()).resolves.toBe(registration);
    expect(container.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('väntar tills en nyinstallerad worker är aktiv', async () => {
    const worker = fakeWorker(`${origin}/push-sw.js`, 'installing');
    const registration = fakeRegistration({ installing: worker });
    container.register.mockResolvedValue(registration);

    let settled = false;
    const pending = ensurePushRegistration().then((value) => { settled = true; return value; });
    await Promise.resolve(); await Promise.resolve();
    worker.become('installed');
    await Promise.resolve();
    expect(settled).toBe(false);

    worker.become('activated');
    await expect(pending).resolves.toBe(registration);
    expect(worker.listenerCount()).toBe(0);
  });

  it('ger upp med ett fel i stället för att hänga när workern aldrig blir aktiv', async () => {
    vi.useFakeTimers();
    const worker = fakeWorker(`${origin}/push-sw.js`, 'installing');
    container.register.mockResolvedValue(fakeRegistration({ installing: worker }));

    const pending = ensurePushRegistration(5_000);
    const outcome = expect(pending).rejects.toThrow('startade inte i tid');
    await vi.advanceTimersByTimeAsync(5_000);
    await outcome;
    expect(worker.listenerCount()).toBe(0);
  });

  it('ger ett fel när installationen misslyckas', async () => {
    const worker = fakeWorker(`${origin}/push-sw.js`, 'installing');
    container.register.mockResolvedValue(fakeRegistration({ installing: worker }));

    const pending = ensurePushRegistration();
    const outcome = expect(pending).rejects.toThrow('kunde inte installeras');
    await Promise.resolve(); await Promise.resolve();
    worker.become('redundant');
    await outcome;
  });

  it('registrerar ingenting i förhandsvisningen', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'id-preview--abc.lovable.app' });
    await expect(ensurePushRegistration()).rejects.toThrow('publicerade appen');
    expect(container.register).not.toHaveBeenCalled();
  });
});

describe('currentPushSubscription', () => {
  it('svarar null utan att registrera något när ingen worker finns', async () => {
    container.getRegistration.mockResolvedValue(undefined);
    await expect(currentPushSubscription()).resolves.toBeNull();
    expect(container.register).not.toHaveBeenCalled();
    expect(container.getRegistration).toHaveBeenCalledWith('/');
  });

  it('lämnar tillbaka webbläsarens prenumeration när den finns', async () => {
    const subscription = { endpoint: 'https://push.example.test/abc' };
    const registration = fakeRegistration({ active: fakeWorker(`${origin}/push-sw.js`, 'activated') });
    registration.pushManager.getSubscription.mockResolvedValue(subscription);
    container.getRegistration.mockResolvedValue(registration);
    await expect(currentPushSubscription()).resolves.toBe(subscription);
  });
});

describe('isPushOnlyRegistration', () => {
  it('känner igen push-workern oavsett vilket tillstånd den är i', () => {
    for (const slot of ['active', 'waiting', 'installing'] as const) {
      expect(isPushOnlyRegistration(fakeRegistration({ [slot]: fakeWorker(`${origin}/push-sw.js`, 'activated') }) as never)).toBe(true);
    }
  });

  it('släpper inte igenom andra workers eller tomma registreringar', () => {
    expect(isPushOnlyRegistration(fakeRegistration({ active: fakeWorker(`${origin}/sw.js`, 'activated') }) as never)).toBe(false);
    expect(isPushOnlyRegistration(fakeRegistration({ active: fakeWorker(`${origin}/x/push-sw.js`, 'activated') }) as never)).toBe(false);
    expect(isPushOnlyRegistration(fakeRegistration({ active: fakeWorker(`${origin}/push-sw.js.map`, 'activated') }) as never)).toBe(false);
    expect(isPushOnlyRegistration(fakeRegistration() as never)).toBe(false);
  });
});

describe('återställning av gammalt app-skal', () => {
  const push = () => fakeRegistration({ active: fakeWorker(`${origin}/push-sw.js`, 'activated') });
  const caching = () => fakeRegistration({ active: fakeWorker(`${origin}/sw.js`, 'activated') });

  beforeEach(() => {
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    vi.stubGlobal('location', { href: `${origin}/app`, hostname: 'honsgarden.se', origin, replace: vi.fn() });
  });

  it('recoverStalePwaShell tar bort cachande workers men behåller push-prenumerationen', async () => {
    const pushRegistration = push();
    const cachingRegistration = caching();
    container.getRegistrations.mockResolvedValue([pushRegistration, cachingRegistration]);

    await recoverStalePwaShell('test');

    expect(cachingRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(pushRegistration.unregister).not.toHaveBeenCalled();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
  });

  it('clearBrowserAppCaches avregistrerar inte push-workern, bara uppdaterar den', async () => {
    const pushRegistration = push();
    const cachingRegistration = caching();
    container.getRegistrations.mockResolvedValue([pushRegistration, cachingRegistration]);

    await clearBrowserAppCaches({ unregisterServiceWorkers: true });

    expect(cachingRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(pushRegistration.unregister).not.toHaveBeenCalled();
    expect(pushRegistration.update).toHaveBeenCalledTimes(1);
  });
});
