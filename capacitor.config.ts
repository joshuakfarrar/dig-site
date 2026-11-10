import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The game as an Android and iOS app. The built game in `dist` ships inside the app and runs
 * offline; nothing is fetched. The app id is permanent once it's on either store, so it needs
 * settling before the first upload.
 *
 * `appId` only reaches a native project when the platform is first added (`cap add`); after that
 * each project keeps its own, and `cap sync` doesn't change it:
 * - Android: `social.josh.digsite` (`applicationId` in android/app/build.gradle)
 * - iOS: `io.github.joshuakfarrar.dig-site` (the App target's bundle identifier in Xcode)
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
  plugins: {
    // Full screen: no status bar, and the iPhone's home bar tucked away (it fades back on a touch
    // near the bottom edge).
    SystemBars: { hidden: true },
  },
};

export default config;
