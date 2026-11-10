import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The game as an Android and iOS app. The built game in `dist` ships inside the app and runs
 * offline; nothing is fetched.
 *
 * The app id, `io.github.joshuakfarrar.digsite`, is the same on every store and permanent once
 * the app is on one. (No hyphen: Android ids can't have one, and Apple's can't have underscores.)
 * `appId` only reaches a native project when the platform is first added (`cap add`); after that
 * each project keeps its own, and `cap sync` doesn't change it, so a change goes in three places:
 * - here
 * - Android: `applicationId` and `namespace` in android/app/build.gradle, `strings.xml`, and
 *   `MainActivity`'s package (and folder)
 * - iOS: the App target's bundle identifier in Xcode (`PRODUCT_BUNDLE_IDENTIFIER`)
 */
const config: CapacitorConfig = {
  appId: "io.github.joshuakfarrar.digsite",
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
