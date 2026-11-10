# iOS

The same game, wrapped for iPhone and iPad with Capacitor, like the Android app. The project is in
`ios/` and was made on Windows; building it needs a Mac with Xcode.

## What's set up

- **Bundle id:** `io.github.joshuakfarrar.dig-site`, shown as "Dig Site". It's set on the App target in Xcode (General, or Signing & Capabilities), not by `capacitor.config.ts`, whose `appId` is Android's `social.josh.digsite`. It can't change once the app is on the App Store, so settle it first.
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

## Still to do

- **In-app purchase (StoreKit):** the one unlock, plus "Restore purchase", through a small native plugin. `src/shop.ts` has the calls to fill in.
- **Store listing:**
  - The Kids category (ages 5 and under, or 6 to 8).
  - The privacy label says "Data Not Collected".
  - Screenshots from an iPad and an iPhone.
- **Privacy manifest:** none is added for the app itself, because its own code uses none of Apple's "required reason" APIs, and Capacitor ships its own manifest. If App Store Connect emails an `ITMS-91053` warning after the first upload, add a `PrivacyInfo.xcprivacy` for whatever it names.
