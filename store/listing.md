# Store listing

The words for Dig Site's pages on the App Store, Google Play and the Amazon Appstore, ready to paste.
They're written for parents (the people reading store pages), checked against what's actually in
the game, and kept within each store's limits (character counts in brackets).

Rules every store holds a kids' app to, which this copy keeps:
- No "best" or "#1", no prices or "free" in the name, no emoji, and nothing in capitals.
- Nothing promised that isn't in the game.
- No claim that it's educational. It's a calm building toy, and saying more invites review questions.

## Name

| Store | Field | Text |
|---|---|---|
| Apple | Name (30) | **Dig Site: Build a Town** (22) |
| Apple | Subtitle (30) | **Diggers, cranes, happy homes** (28) |
| Google | Title (30) | **Dig Site: Build a Town** (22) |
| Amazon | Title | **Dig Site: Build a Town** |

If the trademark search turns up a problem with "Dig Site", only the first two words change.

## Short description

- **Google, short description (80):** "Drive diggers and cranes to build homes for a little town. No ads, no reading." (79)
- **Apple, promotional text (170)**, which can change any time without a review: "Dig, pour, lift the walls and lower the roof, then watch a family move in. A calm building game for little ones, with no ads, no timers and nothing to read." (155)
- **Amazon, short description:** the same as Google's.

## Full description

The same for all three stores. It's within Apple's and Google's 4,000 characters, and Amazon's
long description.

> Build a town, one home at a time.
>
> Dig Site is a calm building game for children aged about 3 to 7. Drive chunky machines around a building site and build each home from the ground up: dig the hole with the excavator, pour the floor from the mixer truck, swing the walls into place with the crane and lower the roof on. Then the family moves in, and the street fills up.
>
> There are three neighbourhoods, each with eight lots to build: Home Street with its houses and playground, Market Square with the school, café, library and town hall, and the Harbour with its lighthouse and aquarium.
>
> MADE FOR SMALL HANDS
> • One stick to drive, one button to work, one to hop into the next machine. The buttons appear only when there's something to do.
> • Nothing to read, and nothing to lose. Mistakes simply don't happen.
> • No timers, no scores and no hurry.
>
> MADE FOR PARENTS
> • No ads, ever.
> • No data collected. No accounts, no tracking, and the game never goes online.
> • Plays offline, so it's good for car trips and planes.
> • The first two homes are free. One purchase, behind a grown-ups' question, unlocks every street and every neighbourhood added later. No subscriptions.
>
> Made with care by Galu, a small independent studio.

Apple and Google don't show bold or headings in descriptions, so the two section titles are in
capitals to stand out. That's a common choice, but they can be left out.

## Apple only

- **Keywords (100, commas, no spaces needed):** `kids,toddler,construction,digger,excavator,crane,truck,building,town,preschool,calm,offline,no ads` (99). Apple already indexes the words in the name and subtitle.
- **Category:** Games, then Kids, then ages 5 and under, or ages 6–8 (see `forms.md`). Secondary category: Games > Simulation.
- **Support URL:** https://galu.games/dig-site/#support
- **Marketing URL:** https://galu.games/dig-site/
- **Privacy policy URL:** https://galu.games/dig-site/privacy/
- **Copyright:** © 2026 Galu LLC

## Google only

- **App category:** Game > Simulation. It's tagged for kids by the target-audience form, not the category.
- **Tags:** pick from Google's list. "Building", "Construction", "Casual", "Offline", "Single player".
- **Contact email:** hello@galu.games. **Website:** https://galu.games/dig-site/. **Privacy policy:** https://galu.games/dig-site/privacy/

## Amazon only

- **Feature bullets (3–10):**
  - Drive diggers, mixer trucks and cranes to build homes from the ground up
  - Three neighbourhoods to fill, twenty-four buildings in all
  - Made for small hands: one stick, one Work button, nothing to read
  - No ads, no data collected, plays fully offline
  - First two homes free; one purchase unlocks everything
- **Keywords:** kids, toddler, construction, digger, excavator, crane, building, town, preschool, offline
- **Category:** Games > Kids (Amazon's own kids' category, if offered), or Games > Casual.

## What's new (version 1.0)

"The first release: Home Street, Market Square and the Harbour, twenty-four buildings in all."

## Pictures

`python tools/make_store_art.py` makes them all in `capture/store/` (not in git). Its opening
comment says how to render the screenshots first, from the game itself, on the dev server.

- **Screenshots:** eight per set, in this order:
  1. a family moving in
  2. the crane lowering a roof
  3. digging
  4. Market Square growing
  5. the playground
  6. pouring the floor
  7. neighbours along Home Street
  8. the Harbour
- **The sets:**

  | Folder | Size | Where it goes |
  |---|---|---|
  | `apple-iphone-6.9/` | 2868×1320 | App Store: iPhone (the 6.9" set; Apple scales it down for smaller iPhones) |
  | `apple-ipad-13/` | 2752×2064 | App Store: iPad (the 13" set) |
  | `android-16x9/` | 1920×1080 | Google Play: phone. Amazon. |
  | `android-16x10/` | 1920×1200 | Google Play: 7" and 10" tablet. Amazon. |

- **No words on the screenshots,** and no interface. They're the 3D game itself, drawn by its own renderer from the camera paths in `src/promo.ts` (`promo.stills`). Words could go on later as a caption band, for parents.
- **The finished neighbourhoods turn to dusk,** so the Market Square and Harbour views are half built, in daylight (the `STILLS` shots).
- **`google-feature-graphic.png`:** 1024×500, the family moving in, with the icon, "Dig Site" and "Build a town, one home at a time."
- **`icon-512.png`** for Google Play, and **`icon-114.png`** with the 512 for Amazon. Apple takes its icon from the app itself.
- **Preview video:** not made yet.
  - Apple's must be 15–30 s of footage from the app, landscape for a landscape app (1920×886 for the iPhone set, 1600×1200 for the iPad).
  - Google's is a YouTube link.
  - The 26-second reel is vertical, so it suits YouTube Shorts and Amazon. The App Store needs a landscape cut from the story trailer's footage, with no captions.
