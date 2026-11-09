# Android

The game is wrapped as an Android app with [Capacitor](https://capacitorjs.com). The built web game
(`dist`) ships inside the app and runs fully offline.

## What's set up

- **App id:** `social.josh.digsite`. **Name:** Dig Site. Both are in `capacitor.config.ts`.
  - The app id can't change once it's on the Play Store, so settle it, and the name, before the first upload.
  - If the id changes, also update `android/app/build.gradle` (`applicationId`, `namespace`) and the Java package folder.
- **No permissions at all** (`AndroidManifest.xml`): the internet permission is removed, so the app can't go online even by mistake.
- **Locked to landscape** (`sensorLandscape`): it turns with the tablet, but never stands upright.
- **Full screen and awake** (`MainActivity.java`): the status and navigation bars are hidden (swipe from the edge to bring them back for a moment), and the screen doesn't sleep while it's open.
- **Back button** (`main.ts`): on the title it closes the app. In play it never leaves; it only bounces the hold-to-confirm corner button, so a grown-up can see how to get out.
- **Web debugging** is off in the shipped app.

## Building it

You need **Android Studio**, which brings the Android SDK, with a recent JDK; Java 23 is already on this PC. Then:

```bash
npm run build
```

```bash
npx cap sync android
```

```bash
npx cap open android
```

In Android Studio, plug in a tablet with USB debugging on, or start an emulator, and press Run.

To make a file to install directly:

```bash
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

For the Play Store, build a signed **App Bundle** (`.aab`): **Build > Generate Signed App Bundle**. Keep the signing key safe, because every update has to be signed with it.

## Icon and splash

- `python tools/make_icons.py` draws them (Pillow) and writes every size into `res/`:
  - the adaptive icon's two layers: the sky and hill (`ic_launcher_background`) and the excavator (`ic_launcher_foreground`)
  - square and round icons for older launchers
  - every `splash.png`
- It also writes store masters to `resources/`: `icon-512.png` for Google Play, `icon-1024.png` for Apple, `splash-2732.png`.
- Android 12 and later show the icon on the sky colour (`windowSplashScreenBackground` in `styles.xml`); older ones, Fire OS 8 included, show the splash picture.

## The free tier

- Off in every build until store purchases work, so nothing a family installs is ever locked without a way to unlock it.
- `VITE_PAYWALL=on npm run build` turns it on: the first two lots are free, then padlocks.
- To try it on the dev server, open `?paywall`.

## Still to do
- Testing on a cheap tablet. The triangle cut in `voxel.ts` (merged faces) took a full street from about 490k to about 80k triangles.
- The Play Console listing, the data-safety form (no data collected) and the Families policy. See `roadmap.md`, Phase 5.
