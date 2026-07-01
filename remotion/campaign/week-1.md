# Hyperyzer — Week 1 Video Campaign

**One animated short-form video per day** (same kinetic-typography/motion-graphics style as the launch ad). Built in Remotion, rendered 9:16 for TikTok / Reels / Shorts.

## Operating rules (grounded in product reality + the `social`/`video`/`ad-creative` skills)
- **Goal this week = reach + FREE signups, not sales.** Paddle checkout isn't live yet, so every CTA drives to the free tier (`hyperyzer.com` — "10 credits, no card"). Do **not** push paid plans.
- **Hold paid spend.** No OpenAI spend cap + free Render infra (cold starts, DB expires 2026-07-20). A big paid/viral spike could rack up AI cost and hit a cold app. Boost the winning organic post **only after** checkout is live, Render is on a paid plan, and a spend cap is set.
- **Native > polished.** Each video is **short (11–16s)**, hook in the **first 1 second**, on-screen text always (85% watch muted), one CTA.
- **Cadence:** post the day's video on TikTok + Reels + Shorts. Reply to every comment in the first hour. Dogfood: post at the time Hyperyzer's "best time to post" recommends.
- **Track:** signups + free analyses run + saves/shares — not likes.

## Reusable Remotion components (all already built in `src/HyperyzerAd.tsx`)
`Backdrop` (dark/light morph) · `BrandMark` · `Grad` (gradient text) · `Pop` (entrance/exit) · `CountUp` · score tiles + bars · hashtag `Chip` · glass card · `OptimizeStrip`/`OptStat` (green ▲ jumps) · `TypeLine` (typewriter) · best-time gradient bar + `IconClock`/`IconZap`/`IconSparkle` · `Audio` bed via `scripts/render-audio.mjs`.

Each day = a new short composition assembled from these. Keeps build time low.

---

## DAY 1 — "The 5-Second Test"  ·  pillar: PROBLEM/hook  ·  ~12s
**Hook (0–1s):** "Your video gets 5 seconds. Here's what happens in them."
**Beat sheet**
- `0.0–1.0s` — Dark. Big gradient **"5 SECONDS"**, kicker above: `THE SCROLL TEST`. SFX: impact.
- `1.0–4.0s` — A countdown **5→4→3→2→1** (huge numerals), each tick a glitch SFX; behind it a red **Hook 41/100** tile pulsing. Text: "Weak hook = instant scroll."
- `4.0–8.0s` — BrandMark pops (dark→light morph). "Hyperyzer scores your hook **before** you post." Hook tile re-scores **41 → 89** (count-up, bar fills pink). SFX: power-up + ding.
- `8.0–12.0s` — CTA: gradient pill **"Score your next video — free"** + `hyperyzer.com`.
**Caption:** "Your video has 5 seconds to survive. Mine scored 41/100 — here's how I fixed it. Free 👇"
**Hashtags:** `#contentcreator #tiktokgrowth #hookwriting #viralvideo #creatortips #hyperyzer`
**Build notes:** reuse one score tile + count-up, BrandMark, CTA scene. New: countdown numerals (reuse `Grad` + `Pop`).

---

## DAY 2 — "Watch an AI score this hook"  ·  pillar: DEMO/meta  ·  ~14s
**Hook (0–1s):** "I let an AI grade my video hook. Brutal."
**Beat sheet**
- `0.0–1.5s` — Light glass card slides up. Title row: a real-sounding hook line types in — `"POV: you've never seen a 100-day hardcore run end like this"` + `✦ AI` badge.
- `1.5–8.0s` — Three score tiles count up one-by-one with bars + ding on each: **Hook 88 / Retention 74 / Viral 91**.
- `8.0–11.0s` — Verdict pill: "**Strong hook. Fix retention.**" (retention tile flashes amber).
- `11.0–14.0s` — CTA pill **"Analyze your next video — free"** + `hyperyzer.com`.
**Caption:** "Paste your video idea → get a Hook / Retention / Viral score in seconds. No more posting and praying. Free 👇"
**Hashtags:** `#aitools #contentcreator #videomarketing #creatortips #tiktokgrowth #hyperyzer`
**Build notes:** straight reuse of the Demo card (title row + 3 tiles) trimmed; add a verdict pill. ~90% existing components.

---

## DAY 3 — "Why your last video flopped"  ·  pillar: EDUCATIONAL/list  ·  ~15s
**Hook (0–1s):** "3 reasons your last video flopped (it wasn't the algorithm)."
**Beat sheet**
- `0.0–1.0s` — Dark. Kicker `WHY IT DIED`.
- `1.0–7.0s` — Three rows slide in (reuse `ProblemRow`): **✕ Weak hook · ✕ Wrong hashtags · ✕ Posted at 3 A.M.** (one every ~1.3s).
- `7.0–11.5s` — Morph to light, BrandMark. "Hyperyzer fixes all three." Mini montage: hook score ✓, 5 hashtag chips pop ✓, best-time bar ✓.
- `11.5–15.0s` — CTA **"Fix your next video — free"** + `hyperyzer.com`.
**Caption:** "It's almost never the algorithm. It's these 3 things 👇 (all fixable in seconds, free)"
**Hashtags:** `#tiktoktips #contentcreator #socialmediatips #videomarketing #creatorcommunity #hyperyzer`
**Build notes:** reuse `ProblemRow` scene + hashtag chips + best-time bar. Mostly existing.

---

## DAY 4 — "One click. +18 points."  ·  pillar: TRANSFORMATION/before-after  ·  ~13s
**Hook (0–1s):** "Watch one click rewrite my whole video."
**Beat sheet**
- `0.0–2.0s` — Light card, three stat chips show "before": **Hook 88 · Retention 74 · Viral 91** (slate).
- `2.0–4.0s` — Gradient **⚡ One-Click Optimize** pill bumps in. SFX: power-up.
- `4.0–9.0s` — Chips flip green with ▲ bump (reuse `OptStat`): **Hook 96 ▲ · Retention 90 ▲ · Viral 97 ▲**. Big "+18 total" callout.
- `9.0–13.0s` — CTA **"Optimize your next video — free"** + `hyperyzer.com`.
**Caption:** "Before vs after, one click. 88→96 hook, 74→90 retention. Try it free 👇"
**Hashtags:** `#contentcreator #aitools #beforeandafter #videoediting #tiktokgrowth #hyperyzer`
**Build notes:** direct reuse of `OptimizeStrip`/`OptStat`. Add a "+18" Pop. Fast build.

---

## DAY 5 — "It doesn't just score it — it writes it"  ·  pillar: FEATURE (Studio)  ·  ~16s
**Hook (0–1s):** "An AI that writes your video script, beat by beat."
**Beat sheet**
- `0.0–2.0s` — Kicker `THE STUDIO`. Headline: "Don't just score it — **it writes it for you.**" (gradient).
- `2.0–12.0s` — Glass "AI Script Writer" card; four lines typewriter in (reuse `TypeLine`): **HOOK / BEAT / TWIST / CTA**.
- `12.0–16.0s` — CTA **"Try the free analyzer →"** + `hyperyzer.com` (note: Studio is Pro — tease it, but send to free).
**Caption:** "It scores your video AND writes the script — hook, beat, twist, CTA. Start free 👇"
**Hashtags:** `#scriptwriting #aitools #contentcreator #videomarketing #creatortips #hyperyzer`
**Build notes:** reuse the Studio scene wholesale. Change CTA to free analyzer (checkout-down rule).

---

## DAY 6 — "Post at the right time"  ·  pillar: TIP + feature  ·  ~11s
**Hook (0–1s):** "You're posting at the wrong time. Here's proof."
**Beat sheet**
- `0.0–1.5s` — Light. A 7-day mini grid; most cells dim.
- `1.5–6.0s` — Two cells light up gradient (Tue, Thu). Best-time gradient bar (reuse) with `IconClock`: **"Tue & Thu · 6–9 PM"**, kicker `BEST TIME TO POST`.
- `6.0–8.5s` — "Hyperyzer tells you when your audience is actually watching."
- `8.5–11.0s` — CTA **"Find your best time — free"** + `hyperyzer.com`.
**Caption:** "Right video, wrong time = dead reach. Find your real window 👇 (free)"
**Hashtags:** `#socialmediatips #contentstrategy #tiktokgrowth #creatortips #bestpostingtime #hyperyzer`
**Build notes:** reuse best-time bar + `IconClock`. New small piece: 7-cell week grid (simple flex of `Pop` cells).

---

## DAY 7 — "Start free. 10 credits. No card."  ·  pillar: OFFER/CTA  ·  ~12s
**Hook (0–1s):** "Free AI that grades your videos before you post."
**Beat sheet**
- `0.0–4.0s` — Fast recap montage (½-second flashes): score card → green optimize → hashtags → best-time bar. SFX: rapid pops.
- `4.0–7.0s` — Gradient **"Start free."** (huge) + "10 credits. No card. No risk."
- `7.0–9.0s` — Free tier card pops (reuse `TierCard` Free w/ START HERE badge).
- `9.0–12.0s` — BrandMark + CTA pill **"Analyze your next video — free"** + `hyperyzer.com`.
**Caption:** "10 free credits. No card. Score your hook, retention & viral odds before you hit post 👇"
**Hashtags:** `#freetools #contentcreator #aitools #tiktokgrowth #videomarketing #hyperyzer`
**Build notes:** reuse pricing `TierCard` (Free only) + CTA scene + quick montage of prior scenes. Best candidate to **boost as a paid ad once checkout is live.**

---

## Posting schedule (suggested)
| Day | Video | Angle |
|----|----|----|
| Mon | Day 1 — 5-Second Test | Problem / scroll-stopper |
| Tue | Day 2 — Watch an AI score this hook | Demo |
| Wed | Day 3 — Why your last video flopped | Educational |
| Thu | Day 4 — One click. +18 points | Transformation |
| Fri | Day 5 — It writes it for you | Feature (Studio) |
| Sat | Day 6 — Post at the right time | Tip |
| Sun | Day 7 — Start free | Offer / boost-ready |

Rendered files land in `remotion/out/`. Audio bed per video via `npm run audio` (adapt length in `scripts/render-audio.mjs`).
