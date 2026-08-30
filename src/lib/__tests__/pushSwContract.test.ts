import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * Kontraktstest för web push-kedjan (swarm I).
 * V1-research hävdade att push/notificationclick-handlers saknades — det var
 * redan åtgärdat på main; dessa tester låser kontraktet så att kedjan inte
 * tyst kan brytas igen.
 */
describe('push service worker contract', () => {
  const pushSw = read('public/push-sw.js');
  const workboxSw = read('src/sw.ts');

  it('Workbox-SW importerar push-sw.js', () => {
    expect(workboxSw).toContain('importScripts("/push-sw.js")');
  });

  it('lyssnar på push och visar en notis', () => {
    expect(pushSw).toContain("addEventListener('push'");
    expect(pushSw).toContain('showNotification');
  });

  it('lyssnar på notificationclick med deep link + fokus/navigering', () => {
    expect(pushSw).toContain("addEventListener('notificationclick'");
    expect(pushSw).toContain('clients.matchAll');
    expect(pushSw).toContain('openWindow');
    expect(pushSw).toContain('notification.data');
  });

  it('rapporterar klick tillbaka till appen för mätning', () => {
    expect(pushSw).toContain('postMessage');
    expect(pushSw).toContain('honsgarden:push-notification-click');
  });

  it('appen lyssnar på SW-klickmeddelandet och mäter Notification Clicked', () => {
    const hook = read('src/hooks/usePushNotifications.ts');
    expect(hook).toContain('honsgarden:push-notification-click');
    expect(hook).toContain("trackEvent('Notification Clicked'");
  });

  it('instrumenterar prompt/permission/prenumeration', () => {
    const hook = read('src/hooks/usePushNotifications.ts');
    expect(hook).toContain("trackEvent('Push Prompt Shown'");
    expect(hook).toContain("trackEvent('Push Permission Result'");
    expect(hook).toContain("trackEvent('Push Subscription Created'");
  });
});
