import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mimora.ios',
  appName: 'Mimora',
  // Load live from Vercel — no static bundle needed
  // Updates go live instantly when you push to Vercel
  server: {
    url: 'https://memora-app-one.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0D4F57',
      showSpinner: false,
    },
  },
};

export default config;
