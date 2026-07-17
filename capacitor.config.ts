import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.honsgarden.app',
  appName: 'Hönsgården',
  webDir: 'dist',
  // Produktion: ingen server.url — appen laddar de inbyggda filerna från webDir.
  // För live-reload under utveckling, lägg tillbaka ett server-block tillfälligt:
  // server: { url: 'http://192.168.x.x:8080', cleartext: true },
  ios: {
    contentInset: 'always',
  },
  plugins: {
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
