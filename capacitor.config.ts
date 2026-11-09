import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The game as an Android and iOS app. The built game in `dist` ships inside the app and runs
 * offline; nothing is fetched. The app id is permanent once it's on either store, so it needs
 * settling before the first upload.
 */
const config: CapacitorConfig = {
  appId: "social.josh.digsite",
  appName: "Dig Site",
  webDir: "dist",
  android: {
    // No pinch-zoom, no text selection, no web debugging in the shipped app.
    webContentsDebuggingEnabled: false,
  },
  ios: {
    // The page fills the screen edge to edge; the game keeps clear of notches itself (safe-area insets).
    contentInset: "never",
    // The game's sky, behind the page while it loads.
    backgroundColor: "#a9dcff",
    webContentsDebuggingEnabled: false,
  },
};

export default config;
