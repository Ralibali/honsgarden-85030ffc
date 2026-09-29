import type { CapacitorConfig } from '@capacitor/cli';
import { ANDROID_APPLICATION_ID, IOS_APPLICATION_ID } from './src/lib/nativeAppIds';

const requestedPlatform = process.argv.find((arg) => ['ios', 'android'].includes(arg));
const configuredPlatform = process.env.HONSGARDEN_NATIVE_PLATFORM;
if (configuredPlatform && requestedPlatform && configuredPlatform !== requestedPlatform) {
  throw new Error('Native platform environment does not match the requested platform.');
}
const platform = configuredPlatform || requestedPlatform || 'ios';
if (!['ios', 'android'].includes(platform)) throw new Error('Choose ios or android for native sync.');
if (process.argv.some((arg) => ['sync', 'copy', 'add'].includes(arg))
  && !process.argv.some((arg) => ['ios', 'android'].includes(arg))) {
  throw new Error('Use npm run native:sync to sync both platforms with their own app IDs.');
}

const config: CapacitorConfig = {
  appId: platform === 'android' ? ANDROID_APPLICATION_ID : IOS_APPLICATION_ID,
  appName: 'Hönsgården',
  webDir: 'dist',
  // Produktion: ingen server.url — appen laddar de inbyggda filerna från webDir.
  // För live-reload under utveckling, lägg tillbaka ett server-block tillfälligt:
  // server: { url: 'http://192.168.x.x:8080', cleartext: true },
  ios: {
    // The app header and tab bar own safe-area padding; do not add it twice.
    contentInset: 'never',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#FAF8F4',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
