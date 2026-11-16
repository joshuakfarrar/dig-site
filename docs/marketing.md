# Marketing plan

How Dig Site gets found. The game is finished and honest; almost nobody knows it exists. This is the
plan for changing that, in the order it can happen. **You** is Josh; **Claude** is a Claude session.
Tick things off here, like `launch.md`.

Drafted 2026-11-16, the day the game went to Amazon. Nothing here has been started.

## The aim, in numbers

- **The goal:** a few thousand families paying $2.99.
- **What that takes:** if 2–5% of the families who install it go on to buy (a guess: there's no data
  yet), 3,000 buyers means roughly 60,000 to 150,000 installs. Amazon will give the first real
  number.
- **The launch that counts is iOS and Google Play together.** That's where parents pay for kids'
  apps. Amazon is the rehearsal: the first real purchase, the first real reviews, the first number.
- **When:** the D-U-N-S was applied for on 2026-11-10 and can take about 30 business days, so into
  late December. With Apple's account checks, TestFlight and the featuring lead time below, a real
  iOS launch is likely late January or February 2027. It will miss Christmas; Amazon won't, and
  Christmas is when children get tablets.

## Rules this plan keeps

- **It talks to parents, never to children.** No ads or posts aimed at kids, and nothing inside the
  game ever points out of it (no links, no mailing list, no "rate us").
- **Only true things.** The same rules as `store/listing.md`: no "best", no "educational", nothing
  promised that isn't in the game.
- **Honest reviews only.** Friends are asked to review if they want to, in their own words. Nothing
  is offered for a review, ever. The stores ban it, and it would be a lie.
- **No money on ads.** At $2.54 a sale and a few buyers per hundred installs, an install is worth
  about ten cents. Ads cost dollars an install. The budget is time.

## What can be measured

The game collects nothing, so the stores' own dashboards are the only instruments.

- **Per store:** installs, purchases, refunds, ratings. The number to watch is purchases ÷ installs.
- **Per channel:** every link we hand out gets its own campaign tag, so the store shows where
  installs came from without the game knowing anything.
  - Apple: campaign links, made in App Store Connect's App Analytics.
  - Google Play: tagged links to the store page (its acquisition report reads them).
  - Amazon: no per-link reporting worth relying on; note the dates things were posted instead.
- **The mailing list** (Buttondown, on galu.games): how many grown-ups are waiting.
- [ ] **Claude:** a small table in this file, filled in weekly from numbers you read off the
  dashboards: installs, purchases, rating, per store.

## Now: none of this waits on the D-U-N-S

### Learn from Amazon

- [ ] **You, with Claude:** the first real purchase, once it's live (`launch.md`, "Submit").
- [ ] **You:** read every Amazon review and support email, and paste them to Claude.
- [ ] **The paywall decision,** before iOS is submitted: are two free lots (about fifteen minutes)
  enough for a parent to see their child love it? If the early reviews say "you have to pay", try
  three. It's one number (`FREE_LOTS` in `src/shop.ts`) and a line on the unlock card.

### A list of who to tell

- [x] **Claude:** research `docs/outreach.md`: each place with who runs it, how they take
  submissions, what they want to receive, and their rules on self-promotion (many parenting
  communities ban it outright, and those are left alone). Done 2026-11-16. It came out nearer a
  dozen real chances than two dozen: most kids'-app review blogs have closed.
  - Kids' app review sites and newsletters.
  - Parent bloggers and newsletter writers who cover screen time and calm, ad-free apps.
  - Teachers and librarians who recommend apps for under-eights.
  - Construction-machine and "little builder" corners: the audience that already loves diggers.
- [ ] **You:** cross off anyone you wouldn't want to hear from yourself.

### Things to send them

- [ ] **Claude:** `store/pitch.md`, every piece short:
  - the pitch email (five sentences, one picture, the trailer link, the press kit link);
  - the text for Apple's featuring nomination;
  - the launch email for the mailing list.
- [ ] **Claude (site session):** the press kit on galu.games has what a writer needs in one place:
  a paragraph, a fact sheet (ages, price, no ads, no data, offline), screenshots, the trailer, the
  icon, and support@galu.games.

### A bank of short clips

Short videos of the machines working are the most shareable thing the game has, and the filming
tools already exist (`src/promo.ts`).

- [ ] **Claude:** twelve to fifteen vertical clips, 8 to 15 seconds each, one machine doing one
  thing: the dump truck being loaded and tipping, the crane lowering a roof, the mixer pouring, the
  roller, the sweeper, a family moving in, a street filling up. The dump truck first.
- [ ] **You: where they go.** Pick the accounts (YouTube Shorts, Instagram Reels, TikTok; one is
  enough to start), under Galu or Dig Site, apart from Kickstack.
- [ ] **You: the "made for kids" question.** Videos of a children's game may count as made for
  kids on YouTube and elsewhere, which turns off comments and some reach. Read each platform's rule
  before the first post, and label them as the rule says, even where it costs reach.

### Early players

- [ ] **You:** a dozen families with children aged 3 to 7 who'd try it. They become the TestFlight
  group, the first honest reviews, and the best source of what confuses a four-year-old.

## When the D-U-N-S arrives: the countdown

- [ ] **You:** the Apple and Google accounts (`launch.md`).
- [ ] **Pick the launch date,** at least five weeks out. Everything below counts back from it.
- [ ] **You, with Claude's text: Apple's featuring nomination,** in App Store Connect.
  - Apple asks for at least three weeks before launch; six to eight is better for a new app.
  - It's a long shot, and it's the only route to the big outcome. A calm kids' game with no ads and
    no data is what Apple's editors say they look for.
- [ ] **TestFlight** to the early families, three to four weeks before. Fix what they trip on.
- [ ] **The pitch email** to the outreach list, about two weeks before, with the date and an offer
  of early access.
- [ ] **Google Play:** nothing to apply for. Publishing an app that meets the Families policy puts
  it in the queue for Teacher Approved automatically, though it wants enough downloads first. The
  status shows in Play Console under Policy and programs.
- [ ] **Claude:** campaign links for every channel, in a table here.

## Launch week

- [ ] The launch-day list in `launch.md`: galu.games says "Out now", the mailing list hears first.
- [ ] One clip a day for two weeks, each with the store link.
- [ ] The early families are told it's out. Those who want to leave a review, do.
- [ ] Every review and every support email answered within a day. A kids' game earns its reviews
  by answering parents.

## After

- [ ] **Week one and week four:** read the numbers, per store and per channel. Keep doing what
  brought buyers, stop what didn't.
- [ ] **New neighbourhoods** (roadmap, Phase 8) are the reason to post again, to email the list
  again, and to nominate the update to Apple again.
- [ ] **Google Play Pass:** apply once there are reviews to show.
- [ ] **The price** goes up as the town grows. No sales calendar: parents learn to wait for one.

## Decisions that are yours

| Decision | By when | If you don't decide |
|---|---|---|
| Free lots: two or three | Before iOS is submitted | Two |
| Which accounts the clips go on | Before the first clip | YouTube Shorts only |
| The launch date | When the Apple account is approved | Five weeks after that |
| Whether Amazon gets its own small push now | This week | No: one email to the list when it's live |
| A web demo (two free lots in a browser) | Before the iOS launch | No demo |

## Sources

- Apple, getting featured: https://developer.apple.com/app-store/getting-featured/
- Apple, nominating an app: https://developer.apple.com/help/app-store-connect/manage-featuring-nominations/nominate-your-app-for-featuring/
- Google Play, Teacher Approved: https://support.google.com/googleplay/android-developer/answer/10075896
