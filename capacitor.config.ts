import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.memora.ios',
  appName: 'Mimora',
  server: {
    url: 'https://memora-app-one.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    // Mono palette — matches the white app so load/overscroll doesn't flash teal.
    // Takes effect at the next `npx cap sync ios` + Xcode build.
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
