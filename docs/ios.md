# iOS

The same game, wrapped for iPhone and iPad with Capacitor, like the Android app. The project is in
`ios/` and was made on Windows; building it needs a Mac with Xcode.

## What's set up

- **Bundle id:** `io.github.joshuakfarrar.digsite`, shown as "Dig Site", the same as on Android. It's set on the App target in Xcode (General, or Signing & Capabilities); `capacitor.config.ts` only sets it when the platform is first added. It can't change once the app is on the App Store.
- **Signing:** automatic, with team `X427K457M9`, for both Debug (Run) and Release (Archive). The first Run on a plugged-in iPhone registers it with the team and makes the profile.
- **Landscape only**, turning with the device (`Info.plist`), and the whole screen on an iPad (`UIRequiresFullScreen`: no split view).
- **Full screen:**
  - no status bar (`Info.plist`)
  - the home bar tucked away (Capacitor's SystemBars plugin, `hidden: true` in `capacitor.config.ts`; since Capacitor 8.6 it can't be overridden in `GameViewController`)
  - a swipe from a screen edge needs a second swipe to leave, so steering near the edge doesn't drop a child out of the game
- **Screen stays on** while it's open.
- **Polite sound:** the "ambient" audio session, set both natively and through WebKit's Audio Session API in `audio.ts`.
  - The silent switch silences it.
  - It plays alongside other audio rather than stopping it.
  - A phone call interrupts it, and the next touch brings it back.
- **No export-compliance question** on each upload (`ITSAppUsesNonExemptEncryption` is false).
- **Icon and launch picture:** written by `python tools/make_icons.py`.
- **Offline, nothing collected:** the same built game as Android, under the same "no network" Content Security Policy.
- **Swift Package Manager**, not CocoaPods. The package points into `node_modules`, so run `npm install` on the Mac before opening Xcode.

## The Mac (a 2018 Intel MacBook Pro works for now)

- **Versions:** the 2018 MacBook Pro tops out at **macOS Sequoia 15** (it's on 15.8.3). Apple has accepted uploads built with Xcode 26 and the iOS 26 SDK since April 28, 2026.
- **The last Xcode for this Mac is 26.3.** Xcode 26.0 to 26.3 need Sequoia 15.6 or later. Xcode 26.4 and later need macOS Tahoe 26.2, and Xcode 27 needs Tahoe and Apple silicon. A "requires macOS 26" message means a version that's too new.
- **The catch:** Xcode 27 needs macOS Tahoe and an Apple silicon Mac. Apple usually raises the upload requirement each spring, so expect this Mac to stop being able to upload around **April 2027**.
- **After that:** an Apple silicon Mac, or a cloud Mac build (Codemagic or GitHub Actions; see the roadmap).

## First build, step by step

1. **Update the Mac** to the latest macOS Sequoia (15.6 or later) in System Settings > General > Software Update.
2. **Install Xcode 26.3:**
   1. Not from the App Store, which only offers the newest Xcode. Go to developer.apple.com/download/all, sign in with a free Apple ID, and search for "Xcode 26.3".
   2. Download the `.xip`, about 3 GB. Double-click it to expand it, which takes a while, and drag Xcode into Applications.
   3. Open it once to let it install its parts, including an iOS Simulator.
3. **Install Node.js** (the LTS version from nodejs.org).
4. **Get the project onto the Mac** from GitHub (`joshuakfarrar/dig-site`). The Mac needs to be signed in to GitHub, through an SSH key added to the GitHub account (or the GitHub CLI's `gh auth login`). Then:

   ```bash
   git clone git@github.com:joshuakfarrar/dig-site.git ~/dig-site
   ```

   If it was first cloned from a `.bundle` file, point it at GitHub instead:

   ```bash
   git remote set-url origin git@github.com:joshuakfarrar/dig-site.git
   ```

5. **Build the web game and sync it into the iOS project:** in the project folder, run each in turn.

   ```bash
   npm install
   ```

   ```bash
   npm run build
   ```

   ```bash
   npx cap sync ios
   ```

6. **Open it in Xcode:**

   ```bash
   npx cap open ios
   ```

7. **Try it in the Simulator:** in Xcode, pick an iPad simulator at the top and press Run. That needs no Apple account.
8. **Sign it**, for a real iPad and the store. The store needs the **Apple Developer Program** ($99 a year). In Xcode, select the App target, open **Signing & Capabilities**, tick "Automatically manage signing" and pick your team. Just for your own device, a free Apple ID works: add it in Xcode > Settings > Accounts and pick its "(Personal Team)". The app then stops opening after 7 days until you Run it again.
9. **Try it on a real iPad or iPhone:**
   1. Plug it in, unlock it and tap "Trust" on it.
   2. Turn on Settings > Privacy & Security > Developer Mode on the device; it restarts.
   3. Pick it at the top of Xcode and press Run.
   4. With a free Apple ID, the first launch is refused until you allow your developer certificate in Settings > General > VPN & Device Management.
   5. After the first time, it can run over Wi-Fi without the cable.
   6. Xcode 26.3 may not be able to install on a device running a newer iOS. If it can't, use TestFlight (below) instead.
10. **Upload to TestFlight:**
    1. Choose **Product > Archive**. When it's done, the Organizer opens.
    2. Press **Distribute App**, then **App Store Connect**.
    3. The build appears in App Store Connect under TestFlight after processing, usually within the hour.

## The purchase (StoreKit 2)

- **`App/StorePlugin.swift`:** the same calls as Android's: `sells`, `price`, `buy`, `restore`, and an "owned" event. `GameViewController` registers it (`AppDelegate.swift`), so `SceneDelegate.swift` must make a `GameViewController`, not a plain `CAPBridgeViewController`. Without it the store never loads and nothing is locked.
- **Apple's sheet is shown over the game's window** (`purchase(confirmIn:)` on iOS 17 and later). Without the scene, the Simulator's sheet failed with "Payment Sheet Failed: Presentation failed".
- **One product, `full_game`:** a **Non-Consumable** in App Store Connect, at $2.99 (Tier 3).
- **Ask to Buy:** a child's purchase that waits for a parent says "pending". When it's approved, StoreKit's `Transaction.updates` unlocks the game, and closes the grown-ups' card if it's still up.
- **Restore purchase** syncs with the App Store first (`AppStore.sync`), which may ask the parent to sign in. Apple requires a restore button. The quiet check at start-up only looks at what's on the device, so it never asks.
  - Backing out of that sign-in answers "cancelled", and the card says nothing; "No purchase found" is only for when the App Store was asked.
- **Store can't be reached:** if the product can't be looked up (offline), Unlock answers "unavailable", and the card asks to check the device is online.
- **Refunds re-lock it:** a transaction with a `revocationDate` sends "revoked" (through `Transaction.updates`), and restore answers "revoked" when `Transaction.latest` shows one. See "The free tier and the purchase" in `docs/android.md`.
  - **To try it:** in Xcode, **Debug > StoreKit > Manage Transactions**, select the purchase, and choose **Refund Purchases**. The game should re-lock: the padlocks come back after two lots.
- **Tried in the Simulator** (November 2026), through the game's own padlock, sum and card:
  - **Buying:** the price, cancelling Apple's sheet, and buying.
  - **Start-up check:** after a relaunch, and after a reinstall with the purchase still on record.
  - **Restore:** with and without a purchase, and with the sign-in cancelled.
  - **Failures:** a failed purchase, and a product that can't load.
  - **Ask to Buy:** pending, then approved in the Transaction Manager.
  - **Refunds:** while playing, and after a relaunch.
- **Errors and Ask to Buy for testing:** in `DigSite.storekit`'s editor (Editor menu), turn on Ask to Buy, or pick an error for Load Products or Purchase. Turn them back off afterwards. Deleting the app from the Simulator also clears its test purchases.
- **To try it in the Simulator, with no App Store Connect needed:**
  1. **Test store:** `ios/App/DigSite.storekit` holds `full_game` at $2.99, and the shared App scheme already uses it (Edit Scheme > Run > Options > StoreKit Configuration).
  2. **Run from Xcode.** Only Xcode's Run uses the test store; launching the app any other way finds no product.
  3. **Unlock:** after two lots, the grown-ups' button opens the card, and Unlock shows Apple's test purchase sheet.
  4. **Start over:** Debug > StoreKit > Manage Transactions deletes the purchase, so the padlocks come back on the next launch.

## Still to do

- **Try the purchase on a device:** through the game's own card in the Simulator (above), then on a phone through TestFlight, with `full_game` set up in App Store Connect.
- **Store listing:**
  - The Kids category (ages 5 and under, or 6 to 8).
  - The privacy label says "Data Not Collected".
  - Screenshots from an iPad and an iPhone.
- **Privacy manifest:** none is added for the app itself, because its own code uses none of Apple's "required reason" APIs, and Capacitor ships its own manifest. If App Store Connect emails an `ITMS-91053` warning after the first upload, add a `PrivacyInfo.xcprivacy` for whatever it names.
