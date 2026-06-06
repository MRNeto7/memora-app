import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.memora.ios',
  appName: 'Mimora',
  server: {
    url: 'https://memora-app-one.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false,
    backgroundColor: '#0D4F57',
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0D4F57',
      iosSpinnerStyle: 'small',
      spinnerColor: '#C9A86A',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
