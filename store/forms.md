# Store forms: drafted answers

Each store asks about privacy, ratings and audience before a kids' app can go live. These are the
answers for Dig Site as it's built, with the reasons, so they can be checked rather than taken on
trust. **Confirm each one against the form's current wording when you fill it in;** stores
reword their questions often.

What the answers rest on:
- No ads.
- No analytics, crash reporting or other third-party code that sends anything.
- No accounts, and no internet permission on Android.
- The only purchase goes through each store's own system, behind a parental gate.
- Saved data (the town, settings, the unlock) stays on the device.
- No links out of the app.

## Google Play Console

### App content > Privacy policy
https://galu.games/dig-site/privacy/

### App content > Ads
**No, my app does not contain ads.**

### App content > App access
**All functionality is available without special access** (no login).

### App content > Target audience and content
- **Target age groups:** 5 and under, and 6–8. Picking only these puts the app in the **Families** programme, and Google applies its Families policy.
- **Could the store listing appeal to children?** Yes. It's made for them.
- **Families policy requirements this meets:**
  - no ads
  - nothing collected from children
  - no third-party SDKs that send data (Google's own billing library is allowed, and its logging can't send, because the app has no internet permission)
  - purchases behind a parental gate
  - a privacy policy

### App content > Data safety
- **Does your app collect or share any of the required user data types?** **No.**
  - The game saves its town on the device, and that never leaves it. Data that only stays on the device doesn't count as "collected".
  - Purchases are processed by Google Play itself, which Google says app makers don't declare.
- **Is all of the user data collected by your app encrypted in transit?** Not applicable: nothing is collected.
- **Do you provide a way for users to request that their data is deleted?** Not applicable. (Deleting the app deletes everything.)
- The store will show: **"No data collected" and "No data shared with third parties"**.

### App content > Content rating (IARC questionnaire)
- **Category:** Game.
- **Violence, fear, sexuality, language, controlled substances, gambling:** No to every question.
  - Diggers dig and machines move, but nothing is harmed.
  - There are no fail states and no scary moments.
- **Users can interact or exchange content:** No.
- **Shares the user's location:** No.
- **Allows purchases of digital goods:** Yes (one in-app purchase).
- **Unrestricted internet:** No.
- **Expected result:** Everyone / PEGI 3 / USK 0, the lowest in every region.

### App content > Government apps, financial features, health
No to all.

### Store settings
- **App or game:** Game. **Category:** Simulation.
- **Contact details:** hello@galu.games and https://galu.games/dig-site/

### Monetise > In-app products
- **Product ID:** `full_game`. It can't be changed later, and it has to match the code.
- **Name:** "The whole town". **Description:** "Every lot on every street, and every neighbourhood added later."
- **Price:** USD 2.99. Let Google set the local prices in other countries.
- **Status:** Active.

## App Store Connect

### App Privacy
- **Data collection:** **No, we do not collect data from this app.**
- The label shows **"Data Not Collected"**.
- Purchases through Apple aren't counted as data collected by the app.

### Age rating
- Every content question gets **None**: cartoon violence, realistic violence, horror, mature themes, gambling, and the rest.
- **Unrestricted web access:** No.
- **Contests:** No.
- **Made for Kids:** Yes, then choose the band (below).
- **Result:** 4+.

### Kids category
- **Age band:** **5 and under** or **6–8**. Only one can be chosen.
  - The game is aimed at 3 to 7, so **5 and under** suits its youngest players best.
  - The band can be changed later.
- **The Kids category's rules (App Review guideline 1.3 and 5.1.4), and how the game meets them:**
  - No links out of the app, and no purchase, without a parental gate: the grown-ups' sum guards the only purchase, and there are no links.
  - No third-party analytics or advertising: there's none.
  - No personal data sent anywhere: there's none.

### In-App Purchases
- **Type:** **Non-Consumable**.
- **Reference name:** "Full game". **Product ID:** `full_game`.
- **Price:** USD 2.99.
- **Display name:** "The whole town". **Description:** "Every lot on every street, and every neighbourhood added later."
- **Review screenshot:** the grown-ups' card ("Unlock all of Dig Site"), taken from the game.
- **Family Sharing:** turn it **on**, so siblings' devices share the unlock. That's kind, and parents expect it.

### App Review information
- **Sign-in required:** No.
- **Notes for the reviewer**, ready to paste:
  > Dig Site is a building game for young children, with no ads, no data collection and no network use. The first two lots are free. After building them, a padlock button appears at the top left. It opens a parental gate (a sum written in words, such as "What is four plus seven?", answered on a number pad), then the one in-app purchase, "full_game", and Restore Purchase. Touch controls: drag on the left half of the screen to drive; tap the right half (the orange button) to work. To reach the gate, build two homes (a few minutes each): drive the orange truck to the materials pile, then to a lot's white ring, then follow the arrow from machine to machine on the building site.

### Export compliance
`ITSAppUsesNonExemptEncryption` is false in `Info.plist`, so App Store Connect doesn't ask.

## Amazon Appstore

### Content rating questionnaire
- No to everything: violence, fear, gambling and the rest.
- **Collects user data:** No.
- **Contains in-app purchases:** Yes.
- **Contains advertising:** No.
- **Expected result:** All Ages.

### Target audience and kids
- **Primary audience:** Children (under 13).
- **Opt in to Amazon Kids** (Kids+), if the console offers it. Fire tablets for kids show only apps in it.

### Privacy
- **Privacy policy URL:** https://galu.games/dig-site/privacy/
- **Collects personal information:** No.

### In-App Items
- **SKU:** `full_game`, as an **Entitlement**.
- **Title:** "The whole town". **Price:** USD 2.99.
- Then download the app's key (`AppstoreAuthenticationKey.pem`) for the build.

### Device support
- **Fire tablets only.** Amazon closed its Appstore on other Android phones and tablets in August 2025.
- Amazon stopped making Fire tablets in October 2026; its new Alexa Tablets run Google Play instead.
  The Appstore still serves the Fire tablets families already have, and those get updates for years.
- **Landscape only.**
- **Minimum Android:** 7.0 (API 24).
