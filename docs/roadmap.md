# Roadmap: from prototype to the stores

**Goal:** a small, honest kids' game on Google Play, the App Store and Amazon (Fire tablets).

- **Price:** free to try, then one $2.99 unlock.
- **No:** ads, subscriptions, data collection or internet.
- **Success:** a few thousand families pay for it and are glad they did.

**Rules that hold in every phase:**
- Mechanics stay exactly this simple: drive, one Work button, hop. Nothing to read, no timers, no fail states.
- Safe for kids comes first. Nothing leaves the device; anything grown-up sits behind a parent gate.
- The game gets bigger, not harder. New content means new buildings, machines and places, never new rules.

Time estimates assume you're working part-time and Claude writes most of the code. The calendar mostly waits on playtests, store reviews and Google's two-week test.

---

## Phase 1: Playable on a tablet (1–2 weeks)

What a child will actually hold.

- [x] **Touch controls:**
  - A drag-anywhere stick on the left half of the screen.
  - Big Work and Hop buttons on the right, showing the same pictures as the in-game prompts.
  - Prompts show the touch buttons whenever touch was the last input.
- [x] **Performance tiers:** detect weak devices (or measure frame time) and turn down settings to match:
  - shadow map size
  - pixel ratio
  - antialiasing
  - the number of trees and props
  - Target: a steady 60 fps on a mid-range tablet, and 30 fps or better on a cheap one.
- [x] **Landscape layout:** lock the game to landscape, keep clear of notches and screen edges, and size the buttons for small hands.
- [x] **Pause and resume:** pause and mute when the app goes to the background, and resume cleanly.
- [x] **Fix the site camera:** the finished building currently sits under the progress strip.

**Done when:** a full lot can be built on a real Android tablet and a real iPad with touch only, smoothly.

## Phase 2: Kid playtests (1–2 weeks, alongside Phase 3)

Your wife has shown adults can follow it. This phase checks that a 4-year-old can.

- [ ] Run 4–6 kids aged 3–7, one at a time, on a tablet. Explain nothing; just watch.
- [ ] Note where each one gets stuck, what they try to tap, and when they lose interest or light up.
- [ ] Fix the top issues, then repeat with 2–3 new kids.

**Done when:** most 4–6-year-olds finish a lot and start another on their own.

## Phase 3: Enough game to be worth $2.99 (4–6 weeks)

Roughly 3 to 5 times today's content.

- [ ] **More towns:** grow from 8 lots to about 20, across 3 neighbourhoods:
  - **Home Street:** what exists now.
  - **Market Square:** shops and a school.
  - **Harbour or Hill:** something with a different look, for variety.
  - Finishing a neighbourhood opens the next, celebrated with a road-roller ribbon cutting.
- [ ] **Homes for everyone (the user asked for this; housing for all kinds of families):**
  - **Duplex and row of terraced homes:** one wide footprint with two or three front doors, each painted its own colour.
  - **Small apartment block:** three storeys with balconies. The crane already stacks storeys; check it reaches a third.
  - **Corner block:** flats over a shop, with homes upstairs and the café or bakery below.
  - **Who moves in:** all kinds of households, shown in pictures rather than words:
    - families of every make-up
    - grandparents
    - a wheelchair user, with step-free ramps at the front doors
    - people living alone
    - pets
  - **Shared spaces:** a community garden or play area between the blocks.
  - **Same mechanics:** it's the same dig, pour, walls, roof, path and clean-up; a block is just a bigger blueprint with more doors and more people moving in.
- [ ] **New building kinds** (each one is a blueprint entry):
  - café, bakery, school, library, playground and park, police station
  - a lighthouse or clock tower to finish each neighbourhood
  - a tall tower the crane builds floor by floor
- [ ] **New machines that fit the same controls:**
  - **Dump truck:** the excavator loads it, then you drive it to tip.
  - **Forklift:** stacks pallets in the yard.
  - **Street sweeper:** drive over mess to clean it.
- [ ] **Pick by picture:** choose wall and roof colours from swatches before the crane lifts them.
- [ ] **A living town:**
  - Cars on the roads that always stop for you.
  - Lights that come on at dusk on finished streets.
  - Pets in gardens.
- [ ] **Polish:**
  - Real sound design, still made from code with no files: softer engines and nicer chimes.
  - A gentle music loop.
  - A title screen that's one big Play button.

**Done when:** a fresh player gets an hour or more of varied building before seeing everything.

## Phase 4: App packaging (1–2 weeks)

- [ ] **Wrap with Capacitor** for Android and iOS. The game ships inside the app and runs fully offline, with no web server.
- [ ] **App basics:**
  - an icon and splash screen
  - keeping the screen awake while playing
  - Android's back button sends you home, behind the hold-to-confirm
  - iOS audio-session handling, so a silent switch or a call is respected
- [ ] **iOS builds without a Mac:** a cloud macOS build (Codemagic or GitHub Actions) producing signed builds for TestFlight.
- [ ] **Test on low-end hardware:** a cheap Android tablet, a Fire tablet and an older iPad.

## Phase 5: Purchase, privacy and store paperwork (1–2 weeks, start early)

- [ ] **Free tier:** the first two lots, celebration included. One unlock opens everything, including future updates.
- [ ] **Store purchases:**
  - Use Google Play Billing and Apple StoreKit through a minimal native plugin.
  - No third-party purchase or analytics SDKs; Apple's Kids category bans them, and they'd collect data.
  - Add a "restore purchase" option, which Apple requires.
- [ ] **Parent gate:** something an adult can pass and a small child can't, in front of the purchase, restore and any outside link.
- [ ] **Privacy policy:** one static page ("we collect nothing"), hosted free.
  - Google Play's data-safety form says no data collected.
  - Apple's privacy label says "Data Not Collected".
- [ ] **Ratings and kids programmes:**
  - Age-rating questionnaires for both stores.
  - Google Play's Families policy declaration.
  - Apple Kids category, ages 5 and under or 6–8.
- [ ] **Accounts** (start these early, since verification takes days):
  - Google Play developer account, $25 one-time.
  - Apple Developer Program, $99 a year.
  - Amazon developer account, free.
- [ ] **Name and identity:**
  - Search the stores and trademark records for the name. "Dig Site" may need to change.
  - Check what personal details each store shows publicly for a paid app. An LLC is the usual way to keep your home address off the listing.

## Phase 6: Beta and store listing (2–3 weeks; mostly waiting)

- [ ] **Google Play closed test:** new personal developer accounts have needed about a dozen testers for 14 days before going public, so start this as soon as Phase 4 builds work. Check the current rule when signing up.
- [ ] **TestFlight** for iPhone and iPad testers. Friends and family with kids are ideal.
- [ ] **Store listing:**
  - An icon that reads at thumbnail size: a happy excavator.
  - 5–8 screenshots that show the town growing.
  - A 15–30 s preview video, made with the Shorts workflow.
  - A first line along the lines of: "No ads. No in-app nagging. No internet. Just build."

## Phase 7: Launch (1 week)

- [ ] Ship on Google Play and the App Store the same week, then the Amazon Appstore.
- [ ] A Shorts run: machines building houses in 15-second clips, linking to the stores.
- [ ] Ask for featuring:
  - Apple's featuring nomination in App Store Connect.
  - Google Play's Teacher Approved review and Families programme.
- [ ] Tell kids'-app review sites, parenting forums and communities, plus friends who'll leave honest reviews.

## Phase 8: After launch (ongoing)

- [ ] A free neighbourhood update every 1–2 months; each one is a new reason to post Shorts.
- [ ] Raise the price as the content grows: $3.99 at around 30 lots, $4.99 at around 40.
- [ ] Apply to Google Play Pass.
- [ ] iPad apps run on Apple silicon Macs; turn that on for free extra reach.
- [ ] Read every support email. A kids' game earns its reviews by answering parents.

---

## Decisions to make along the way

| Decision | When | Default if nobody decides |
|---|---|---|
| Final name | Before Phase 5 | Keep "Dig Site" if it's clear |
| Target ages for the store | Phase 5 | 5 and under (Apple), 3–7 (Google) |
| Personal account or LLC | Before Phase 5 | Personal |
| What's free | Phase 5 | First two lots |
| Launch price | Phase 7 | $2.99 |

## Money, roughly

At $2.99 you keep about $2.54 a sale (both stores take 15% from small developers). The lifetime expectation across all stores is about $25–40k, but most of that comes from the small chance of a breakout. The most likely single result is about $5k. Getting found matters more than price or features. Costs are $25 once, plus $99 a year, plus your time.
