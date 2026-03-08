import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mercadopro.app',
  appName: 'MercadoPro',
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
  // En Android, la app corre localmente — no necesita URL externa
  server: {
    androidScheme: 'https',
  },
}

export default config
