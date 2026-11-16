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
  - [x] The trailer re-rendered (2026-11-15) with American spelling ("Soon there were neighbors...") and the dump truck: in the digging shot, the digger now loads it. `capture/dig-site-promo.mp4` and `dig-site-promo-720p.mp4`. The reel has no British spelling in it, and stays as it is (its digging shot has no dump truck).
  - [x] The store preview videos (all three sizes) and the screenshots remade with the dump truck (2026-11-16): the preview opens on the digger loading it, and screenshot 3 (`03-dig.png`) shows the bucket over its bed. The other seven screenshots, the feature graphic and the icons are the same pictures as before (only the confetti and where people stand differ).
  - [ ] **You:** have the galu.games session refresh the press kit and the Dig Site page from the new `capture/dig-site-promo-720p.mp4`.
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
- [x] **You: the upload key** for Google Play and Amazon. It's one `keytool` command (`android.md`, "Release builds and the upload key"). Then fill in `android/keystore.properties`, and back up the `.jks` file and its password together, in a password manager.
- [ ] **You: the Amazon developer account** (free; it doesn't need the D-U-N-S): https://developer.amazon.com, "Sign in", then create an account. Sign up as Galu LLC, with tax (the EIN) and payment details.
  - [x] The account, as Galu LLC.
  - [ ] **Waiting: Galu LLC's business bank account** (opened 2026-11-11, 3–5 business days). Then add it under Settings > Payment Information, and finish the tax identity interview if it's still open. Until then the IAP won't submit: Amazon's page shows only a generic error, but the server's reply is `VENDOR_NO_PAYMENT_INFO`.
  - [x] The bank account and the Royalty Tax Interview are in (2026-11-15). The IAP then failed with `VENDOR_NO_ROYALTY_TAX_INFO_NON_US`: Amazon wants tax details for the stores outside the US, such as Amazon.ca, where Galu has no registration.
  - [x] **The United States only, for now:** set the app's Availability & Pricing to just the United States, then submit the IAP again. Add other countries later, once Amazon's non-US tax details are sorted (Support > My Cases, quoting that error) and the iPostal1 address is approved for the EU's trader rules.
  - Amazon's Appstore now reaches only Fire tablets. Amazon stopped making them in October 2026 (the new Alexa Tablets run Google Play), but there are a great many in families' hands, kids' editions especially, and they get updates for years. It's still worth doing, and Google Play matters more than it did.
  - [x] Create the app ("Dig Site", `io.github.joshuakfarrar.digsite`).
  - [x] Add the in-app item `full_game` as an **Entitlement** at $2.99 ("The whole town"), with its icons.
    - [x] Submitted (2026-11-15), for the United States.
    - [ ] **You:** edit its description in Amazon's console to "Every lot on every street, and every neighborhood added later."
  - [x] Download the app's public key (`AppstoreAuthenticationKey.pem`) and give it to Claude, which puts it in `android/app/src/amazon/assets/`.
  - [x] Upload the signed `amazon` bundle (1.0, build 1).
  - [ ] **You: upload build 5** (1.0, version code 5) in Amazon's console, in place of build 1: `android/app/build/outputs/bundle/amazonRelease/app-amazon-release.aab`, with a copy in Downloads as `dig-site-1.0-build5-amazon.aab`. The app hasn't been submitted, so no review restarts. (Builds 2 to 4 were made the same evening and never uploaded; build 5 has everything in it.) What's new since build 1:
    - The unlock card says "Harbor" and "neighborhood" (build 1: "Harbour", "neighbourhood").
    - Fixes from a look over the whole game before release (2026-11-15):
      - **The parent gate** ignores presses while a wrong answer shakes. Before, a third digit counted ("0", "1", "5" read as 15), and each stray press was another miss.
      - **Digging into the dump truck:** the excavator's ring is now measured from the truck's bed, so Work always comes up in it. Before, a truck parked a little off its mark left a ring and no Work on about one stop in five (Home Street, the free lots included).
      - **A finished building is saved the moment it's done**, not after the confetti. Closing the game during the party used to lose it.
      - **The neighbourhood you've just driven into is remembered**, even before a lot's built there.
      - **A resting thumb** on the left half no longer holds the stick against a finger that wants to steer.
      - **A tap anywhere on the title** starts the game (the left half used to do nothing).
      - **The hold-to-go-back button** on a keyboard or game pad has to be let go before it works again. Held on, it used to run straight from "back to town" into "a new town".
      - **The mixer's arrow** no longer points away from the pit when another machine is parked beside it.
      - **Memory:** each scene's shadow map is freed with the scene.
    - **One button at a time:** while there's work to do right where a machine is, Hop isn't offered to a machine that's just alongside (the digger in its ring beside the dump truck showed both). Found playing build 3 on the Fire.
    - **A purchase Amazon couldn't make says so.** If Amazon fails before its own sheet ever comes up, the card says "Something went wrong with the store. Please try again." Before, a press on Unlock did nothing at all. Closing Amazon's sheet is still a quiet cancel. Found pressing Unlock on the Fire.
    - **More dump truck:** Market Square's school, terrace, police station and playground now have it too, so 16 of the 24 lots do (all of Home Street, half of each other street). The rest keep the bulldozer.
  - [ ] **The developer name:** Company Profile says "Abrilas Galu Games", which the store page shows. Change it to Galu LLC before submitting the app.
  - [ ] **You: the dump truck on Amazon's page.** Replace the video with the new `capture/dig-site-preview-1920x1080.mp4`, and screenshot 3 with the new `capture/store/android-16x10/03-dig.png`. Nothing else there needs replacing.
  - [ ] The Appstore details, from `store/listing.md` and `store/forms.md`: descriptions, icons, screenshots (`capture/store/android-16x10/`), the feature graphic as the promo image, the 1920×1080 preview video, content rating, and privacy. None of this waits on the bank.
- [x] **Claude (Mac): the iOS refund test** (with the rest, in `1cf9b01`). Buy in the Simulator, then Debug > StoreKit > Manage Transactions > Refund Purchases. The padlocks should come back (`ios.md`).
- [x] **Claude: the store listing pack**, in `store/` (`listing.md`, `forms.md`; pictures from `tools/make_store_art.py`):
  - [x] Name, subtitle or short description (80 characters for Google, 30 for Apple's subtitle), full description, and keywords for Apple.
  - [x] Screenshots: iPhone 6.9", iPad 13", Android phone and 7–10" tablet, and Fire (landscape). Each shows the town growing, with no words on the pictures that a child would need to read.
  - [x] Google's feature graphic (1024×500).
  - [x] A preview video, to each store's rules (Apple: 15–30 s, from the app itself): `tools/make_preview.py`.
  - [x] Drafted answers for every form (below), to copy in: `store/forms.md`.
- [ ] **Claude: release builds.** Set the version (1.0.0, build 1), build the signed `play` and `amazon` bundles, and check a release build on the Fire (the real key, no web debugging).
  - [x] `amazon`: signed (1.0, build 1), and the release build runs on the Fire 7 in Production Mode.
  - [x] `amazon`, build 5 (1.0, version code 5, 2026-11-16): signed with the same upload key, for the American spelling, the pre-release fixes and the dump truck on Market Square (listed under the Amazon upload, above).
    - [x] On the Fire 7, in production mode (2026-11-16): two lots built by hand, the padlock, the gate, and the card reading "Harbor" and "neighborhood". Unlock is refused, as it is for any build not installed from the Appstore, and the card says something went wrong.
    - [ ] A real purchase, which only Amazon's Live App Testing or the live store can show.
  - [ ] `play`: build it when there's a Play Console to upload to.

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

- [x] **Amazon** first, if it's ready first. It doesn't wait on the D-U-N-S.
  - Submitted 2026-11-16. Amazon's estimate: live before 10:30 PM PST on 2026-11-20.
  - [ ] **When it's live, the first real purchase:** install it from the Appstore on the Fire 7 (remove the USB-installed build first), build two lots, and buy the unlock. Nobody has seen a real purchase work yet. Then Restore, and a reinstall.
  - [ ] If Amazon's reviewers come back with anything, it goes here.
- [ ] **Google Play:** from internal testing to production.
- [ ] **Apple:** submit for review. Kids' apps can take a little longer, and a rejection usually just needs one fix.
- [ ] **Each store page,** once it's live: check it on a phone (pictures, price, the privacy link).

## Launch day

- [ ] Update galu.games: the store badges, and "Coming soon" becomes "Out now".
- [ ] Send a short email to the mailing list.
- [ ] Post the reel to friends, parents' groups and family.
- [ ] Ask friends who play it to leave an honest review.
- [ ] Nominate the app for Apple's featuring in App Store Connect, and ask Google about Teacher Approved.
