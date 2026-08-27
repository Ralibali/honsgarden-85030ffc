import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/** True only inside the Capacitor iOS binary — not Safari, Android, or PWA. */
export function isNativeIos(): boolean {
  return isNativePlatform() && Capacitor.getPlatform() === 'ios';
}
