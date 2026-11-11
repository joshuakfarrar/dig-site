# Launch checklist

Everything between today and Dig Site on the three stores, in the order it can happen. **You** is
Josh; **Claude** is a Claude session (this PC's for Android, the Mac's for iOS). Tick things off
here as they're done, so every session knows where it stands.

The roadmap (`roadmap.md`) has the reasons; `android.md` and `ios.md` have the how.

## Done

- [x] The game: three neighbourhoods, the free tier, the parent gate, touch controls, loading screen.
- [x] Purchases in all three stores' code (`full_game`, one-time, $2.99).
  - [x] Apple: every path in the Simulator, through the game's own card: buy, cancel, restore, a failed purchase, offline, Ask to Buy pending and approved, refund, relaunch and reinstall (`ios.md`).
  - [x] Amazon: every path through App Tester on a Fire 7: buy, cancel, restore, pending, refund, reinstall, and the card on screen.
  - [ ] Google Play: built, but untested until there's an internal test track (below).
- [x] Privacy policy: https://galu.games/dig-site/privacy/ (the app collects nothing).
- [x] Support page: https://galu.games/dig-site/ (#support).
- [x] Mailing list for grown-ups on galu.games (Buttondown).
- [x] Icon, splash, a 42-second story trailer, and a 26-second vertical reel.
- [x] Galu LLC, and its D-U-N-S number applied for directly with Dun & Bradstreet (2026-11-10). Apple's lookup page didn't offer to apply.
  - Waiting: the free route can take up to about 30 business days. D&B emails the number.
  - After that, Apple can take another day or two to see it. If Apple's form says it can't find the number, wait and try again.
  - D&B sells a faster, paid service. With Amazon not needing the number, it's probably not worth it.

## Now: nothing here waits on the D-U-N-S

- [ ] **You: the name.** Search "Dig Site" in the USPTO's trademark search (https://tmsearch.uspto.gov, no account needed) and in each store. Anything too close in kids' games means choosing another name now, before any store page exists.
  - Claude searched on 2026-11-11 (not a lawyer's clearance search):
    - **"Dig Site" itself is clear.** The only filing for exactly "DIG SITE" is dead (clothing, 1996). The only live "DIGSITE" is for pens.
    - **Nearest live marks:**
      - DIG (Sunny Days Entertainment): toy construction vehicles, class 28.
      - DIG-IT! GAMES: computer games, class 9. They make archaeology games for schools.
      - DIG WORLD (AUC Ventures, filed 2024): construction toys and a play park.
      - Mattel's BUILD AROUND TOWN: toy vehicle sets.
      - Lots of construction-themed kids' play centres use "dig" (Little Diggers, Dig 'n Play, Digs and Rigs), so no one owns "dig" for kids' construction play.
    - **No app called "Dig Site"** turned up on Google Play or the App Store. "Prehistoric Dig Site" and several dinosaur "dig" games share search results.
- [ ] **You: the upload key** for Google Play and Amazon. It's one `keytool` command (`android.md`, "Release builds and the upload key"). Then fill in `android/keystore.properties`, and back up the `.jks` file and its password together, in a password manager.
- [ ] **You: the Amazon developer account** (free; it doesn't need the D-U-N-S): https://developer.amazon.com, "Sign in", then create an account. Sign up as Galu LLC, with tax (the EIN) and payment details.
  - Amazon's Appstore now reaches only Fire tablets. Amazon stopped making them in October 2026 (the new Alexa Tablets run Google Play), but there are a great many in families' hands, kids' editions especially, and they get updates for years. It's still worth doing, and Google Play matters more than it did.
  - [ ] Create the app ("Dig Site", `io.github.joshuakfarrar.digsite`).
  - [ ] Add the in-app item `full_game` as an **Entitlement** at $2.99.
  - [ ] Download the app's public key (`AppstoreAuthenticationKey.pem`) and give it to Claude, which puts it in `android/app/src/amazon/assets/`.
- [x] **Claude (Mac): the iOS refund test** (with the rest, in `1cf9b01`). Buy in the Simulator, then Debug > StoreKit > Manage Transactions > Refund Purchases. The padlocks should come back (`ios.md`).
- [x] **Claude: the store listing pack**, in `store/` (`listing.md`, `forms.md`; pictures from `tools/make_store_art.py`):
  - [x] Name, subtitle or short description (80 characters for Google, 30 for Apple's subtitle), full description, and keywords for Apple.
  - [x] Screenshots: iPhone 6.9", iPad 13", Android phone and 7–10" tablet, and Fire (landscape). Each shows the town growing, with no words on the pictures that a child would need to read.
  - [x] Google's feature graphic (1024×500).
  - [x] A preview video, to each store's rules (Apple: 15–30 s, from the app itself): `tools/make_preview.py`.
  - [x] Drafted answers for every form (below), to copy in: `store/forms.md`.
- [ ] **Claude: release builds.** Set the version (1.0.0, build 1), build the signed `play` and `amazon` bundles, and check a release build on the Fire (the real key, no web debugging).

## The forms (Claude drafts, you submit)

- [ ] **Google Play:**
  - [ ] **Data safety:** no data collected or shared.
  - [ ] **Target audience:** 5 and under, and 6–8. This puts the app under the Families policy.
  - [ ] **Content rating:** the IARC questionnaire. Expect "Everyone" or the lowest rating.
  - [ ] **Ads:** none. **App access:** no login.
  - [ ] **The Families policy declarations.**
- [ ] **Apple, App Store Connect:**
  - [ ] **Privacy label:** "Data Not Collected".
  - [ ] **Age rating:** 4+.
  - [ ] **Kids category:** "5 and under", or "6–8" if that fits better. Its rules need a parental gate before purchases and links (already done), and no third-party analytics or ads (none).
  - [ ] **Export compliance:** none (already in `Info.plist`).
- [ ] **Amazon:**
  - [ ] **Content rating:** "All ages".
  - [ ] **Amazon Kids:** opt in, if offered.
  - [ ] **Privacy:** no data collected.

## When the D-U-N-S number arrives

- [ ] **You: Apple Developer Program** ($99 a year) as Galu LLC. Apple checks the D-U-N-S, and may phone to confirm.
  - [ ] Agreements, tax and banking in App Store Connect. Paid apps and in-app purchases don't work until the Paid Apps agreement is active.
  - [ ] Create the app (bundle id `io.github.joshuakfarrar.digsite`), and the **Non-Consumable** `full_game` at $2.99.
- [ ] **You: Google Play Console** ($25) as an **organisation**, Galu LLC. That skips the 12-tester, 14-day rule for new personal accounts. Identity checks can take a few days.
  - [ ] The payments profile (merchant account), so the game can sell.
  - [ ] Create the app, and the one-time product `full_game` at $2.99.
  - [ ] Add yourself as a license tester.

## Testing in the stores' own channels

- [ ] **Google:**
  - [ ] Upload the signed `play` bundle to **internal testing**, and opt in with your account.
  - [ ] **The first real Google Play test purchase**, with Claude: buy, restore, and reinstall.
  - [ ] Play App Signing: accept Google holding the app-signing key. The upload key stays yours.
- [ ] **Apple:**
  - [ ] Archive on the Mac, then upload to **TestFlight**.
  - [ ] A sandbox purchase on a real iPhone or iPad.
  - [ ] Friends' kids playing through TestFlight.
- [ ] **Amazon:**
  - [ ] Upload the signed `amazon` bundle.
  - [ ] Amazon's **Live App Testing**, if it's wanted: real-store testing with invited testers.

## Submit

- [ ] **Amazon** first, if it's ready first. It doesn't wait on the D-U-N-S.
- [ ] **Google Play:** from internal testing to production.
- [ ] **Apple:** submit for review. Kids' apps can take a little longer, and a rejection usually just needs one fix.
- [ ] **Each store page,** once it's live: check it on a phone (pictures, price, the privacy link).

## Launch day

- [ ] Update galu.games: the store badges, and "Coming soon" becomes "Out now".
- [ ] Send a short email to the mailing list.
- [ ] Post the reel to friends, parents' groups and family.
- [ ] Ask friends who play it to leave an honest review.
- [ ] Nominate the app for Apple's featuring in App Store Connect, and ask Google about Teacher Approved.
