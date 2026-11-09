import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The game as an Android (and later iOS) app. The built game in `dist` ships inside the app and
 * runs offline; nothing is fetched. The app id is permanent once it's on the Play Store, so it
 * needs settling before the first upload.
 */
const config: CapacitorConfig = {
  appId: "social.josh.digsite",
  appName: "Dig Site",
  webDir: "dist",
  android: {
    // No pinch-zoom, no text selection, no web debugging in the shipped app.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
