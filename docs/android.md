# Android

The game is wrapped as an Android app with [Capacitor](https://capacitorjs.com). The built web game
(`dist`) ships inside the app and runs fully offline.

## What's set up

- **App id:** `io.github.joshuakfarrar.digsite`, the same as on iOS, and permanent once it's on Google Play or Amazon. **Name:** Dig Site. Both are in `capacitor.config.ts`, which lists the other places the id lives.
  - The app id can't change once it's on the Play Store, so settle it, and the name, before the first upload.
  - If the id changes, also update `android/app/build.gradle` (`applicationId`, `namespace`) and the Java package folder.
- **No internet** (`AndroidManifest.xml`): the app can't go online, even by mistake.
  - The Google Play build also has `BILLING`, for the purchase, and network-state, which sends nothing.
  - Google's billing library brings Google's logging library, which asks for the internet so it can send the library's own diagnostics to Google. The manifest takes that back out (`tools:node="remove"`). Purchases don't need it, because the Play Store app does the paying.
- **Locked to landscape** (`sensorLandscape`): it turns with the tablet, but never stands upright.
- **Full screen and awake** (`MainActivity.java`): the status and navigation bars are hidden (swipe from the edge to bring them back for a moment), and the screen doesn't sleep while it's open.
- **Back button** (`main.ts`): on the title it closes the app. In play it never leaves; it only bounces the hold-to-confirm corner button, so a grown-up can see how to get out.
- **Web debugging** is off in the shipped app. Debug builds turn it on (`MainActivity`), for testing from a computer.

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

In Android Studio, pick the **playDebug** or **amazonDebug** build variant, plug in a tablet with USB debugging on (or start an emulator), and press Run.

**Two builds, one per store** (`productFlavors` in `android/app/build.gradle`). They're the same game, except for the purchase code:
- **`play`:** Google Play Billing, for Google Play.
- **`amazon`:** Amazon's in-app purchasing (Appstore SDK 3.0.9), for the Amazon Appstore (Fire tablets).

To make a file to install directly (the Fire wants `amazon`):

```bash
cd android && ./gradlew assembleAmazonDebug
```

The APK lands in `android/app/build/outputs/apk/amazon/debug/`, or `play/debug/` for `assemblePlayDebug`.

### Release builds and the upload key

Google Play and Amazon both take a signed **App Bundle** (`.aab`). Every update has to be signed with the same **upload key**, so make it once and keep it safe.

1. **Make the key,** outside the project, in a folder of its own. `keytool` comes with the JDK; it asks for a password, and your name and organisation (Galu LLC):

   ```bash
   keytool -genkeypair -v -keystore C:/Users/you/keys/dig-site-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Copy** `android/keystore.properties.example` to `android/keystore.properties` and fill it in. Git ignores it, and `*.jks`.
3. **Back up** the `.jks` file and its password together, somewhere safe such as a password manager. With Play App Signing, Google holds the real app-signing key, so a lost upload key can be reset, but that takes a support request and days.
4. **Build both bundles:**

   ```bash
   cd android && ./gradlew bundlePlayRelease bundleAmazonRelease
   ```

   They land in `android/app/build/outputs/bundle/playRelease/` and `amazonRelease/`.

Without `keystore.properties`, release builds still work but come out unsigned.

## Icon and splash

- `python tools/make_icons.py` draws them (Pillow) and writes every size into `res/`:
  - the adaptive icon's two layers: the sky and hill (`ic_launcher_background`) and the excavator (`ic_launcher_foreground`)
  - square and round icons for older launchers
  - every `splash.png`
- It also writes store masters to `resources/`: `icon-512.png` for Google Play, `icon-1024.png` for Apple, `splash-2732.png`.
- Android 12 and later show the icon on the sky colour (`windowSplashScreenBackground` in `styles.xml`); older ones, Fire OS 8 included, show the splash picture.

## The free tier and the purchase

- **On only where the unlock can be bought.** The game asks the app's `Store` plugin at start (`src/shop.ts`). Anywhere it can't sell, the whole game is open, so nothing a family installs is ever locked without a way to unlock it.
  - The Google Play build sells if the Play Store is on the device.
  - The Amazon build sells if the Amazon Appstore is on the device and the app's key is built in (below).
  - The web page never sells.
- **One product, `full_game`**, a one-time in-app purchase ("managed product" in Play Console) at $2.99.
- **The plugin:** `StorePlugin.java` (`sells`, `price`, `buy`, `restore`, and an "owned" event), with each store's backend in its own build: `src/play/java/.../PlayBackend.java` (Play Billing Library 9.1) and `src/amazon/java/.../AmazonBackend.java`.
- **Purchases are acknowledged on the device.** There's no server, and Google refunds a purchase that's never acknowledged within three days.
- **Checked with the store quietly at every start.** That picks up a purchase made on another device, or a pending payment that's cleared.
- **Refunds re-lock it, but only when the store says so outright** ("revoked"). The device's memory is changed only by "bought" and "revoked". It's never taken back because the store couldn't be reached, or found nothing.
  - **Amazon** marks the receipt cancelled. It's seen when the game comes back to the front, at start, or on Restore. A purchase made again after a refund wins over the refunded one.
  - **Apple** sets a revocation date on the transaction. It's seen through `Transaction.updates`, or at start through `Transaction.latest`.
  - **Google Play** never re-locks. Its list of purchases just leaves a refunded one out, and that looks the same as another Google account being signed in on a family tablet.
- **To try it on the dev server,** open `?paywall`: padlocks after two lots, and buying just unlocks.
- **Pending purchases:** Google Play's slow payment methods (cash at a shop), and Amazon Kids, where a child's purchase goes to a parent to approve. The card says it's on its way, and it unlocks when the store says so (Amazon's is checked each time the app comes back to the front).
- **To try real Google Play purchases,** the app has to come from Google Play. Upload a signed bundle to an internal testing track, add `full_game` in Play Console, and add your Google account as a license tester. Its purchases are free test purchases.
- **Amazon needs the app's key.** In the Amazon developer console, open the app, then **App Services > In-App Items**, and add `full_game` as an Entitlement. Then download the public key file ("AppstoreAuthenticationKey.pem") and save it as `android/app/src/amazon/assets/AppstoreAuthenticationKey.pem`. It's a public key, so it's fine in git. Without it Amazon never answers, so the build sells nothing.
- **To try Amazon purchases** before it's published, on a Fire tablet (no Amazon account or key needed):
  1. Install Amazon's **App Tester** from the Amazon Appstore.
  2. Give it the product: `adb push android/amazon.sdktester.json /sdcard/amazon.sdktester.json`.
  3. Turn on sandbox mode with `adb shell setprop debug.amazon.sandboxmode debug` (it's off again after a restart), then install the `amazon` **debug** build.
  4. A debug build counts App Tester as the store, even without the key. A release build always needs the real key.
  5. App Tester shows its own purchase sheet: Get Item buys, Cancel cancels, and Request Purchase sends it to a "parent". Approve or decline that under **8. Manage Transactions**, which also undoes purchases. Its screens come out black in screenshots; `adb shell uiautomator dump` reads them.
  6. To call the store from a computer, debug builds allow web debugging: see `tools/webview-eval.mjs`.
- **Tried on a Fire 7 (2022) with App Tester, 2026-11-11:** each of these gave the expected answer:
  - price: "USD2.99" (App Tester's format)
  - buy: "bought", confirmed with Amazon
  - the game remembered it by itself, through the "owned" event
  - Cancel: "cancelled"
  - Restore: "bought"
  - forgotten, then picked back up quietly at the next start
  - Request Purchase: "pending"; once approved, it arrived as "owned" when the game came back to the front
  - Request Purchase, then declined by the "parent": it stayed locked, and Restore said "none"
  - a refund (App Tester's Cancel on the transaction): it re-locked when the game came back to the front, Restore said "revoked", and it stayed locked after a restart
  - bought again after the refund: "bought", and it stayed unlocked after a restart
  - Restore with no purchases on record: "none", leaving an unlocked game unlocked
  - uninstalled and reinstalled: the purchase came back on its own at the first start, while the title was still up
  - on screen: padlocks after two lots, the grown-ups' button, the gate's sum, the card with the store's price, "No purchase found for this account." from Restore, then Unlock through App Tester: the card closed, and the padlocks and the grown-ups' button went

## Still to do
- A real purchase through Google Play's internal testing track. It needs the Play Console account and the upload key.
- The Amazon app's key, from the Amazon developer console, before the first release build.
- The Play Console listing, the data-safety form (no data collected) and the Families policy. See `roadmap.md`, Phase 5.
