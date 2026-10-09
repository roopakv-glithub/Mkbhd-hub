# MKBHD Hub — Fan-made Tribute Site for Marques Brownlee

Premium, dark-mode, mobile-first fan site. Plain HTML/CSS/JS — zero build step, zero bloat.

## Pages
| File | Route | Contents |
|---|---|---|
| `index.html` | Home | Hero, stats, featured videos/series, trust panel, community quotes, **newsletter form**, CTA |
| `about.html` | Story | Ethos panel, 2008→2026 timeline, CTA |
| `community.html` | Community | Highlights grid, **blind-test poll**, **fan submission form**, **fan wall** |

## Interactive features (no build, no API keys)
- **Smartphone Awards countdown** (Home) — live ticking timer to Dec 18 2026, flips to a "watch now" state after the drop.
- **Filterable video grid** (Home) — All / Reviews / Auto Focus / Podcast / Extras chips, instant client-side filtering.
- **Auto latest-upload player** (Home) — YouTube `user_uploads` embed that always shows MKBHD's newest video.
- **Animated stat counters** (Home) — count up on scroll, respects `prefers-reduced-motion`.
- **Blind camera-test poll** (Community) — vote Photo A/B, animated result bars, vote persisted + changeable in `localStorage`.
- **Fan wall** (Community) — form submissions appear instantly from the local backup (XSS-escaped rendering).
- **Scroll-reveal animations + back-to-top button** (all pages, progressive enhancement — content visible without JS).

Shared system: `css/styles.css` (tokens, header/footer, buttons, cards, forms), `js/main.js` (nav, toast, forms).

## Run locally
No tooling needed — double-click `index.html`, or serve properly (recommended, keeps paths clean):

```powershell
# Python (any of these)
python -m http.server 8080 --directory "D:\Santhosh K\mkbhd-site"
# then open http://localhost:8080

# OR Node
npx serve "D:\Santhosh K\mkbhd-site"
```

## Deploy (pick one, ~2 min)
- **Netlify:** drag the `mkbhd-site` folder onto app.netlify.com/drop → live URL instantly.
- **Vercel:** `vercel ./mkbhd-site` or import the folder in the dashboard (no build command, output = `.`).
- **GitHub Pages:** in the repository's **Settings → Pages**, choose **GitHub Actions** as the source. The included workflow deploys the site automatically whenever changes are pushed to `main`.

## Form backend — does it really submit?
Yes. Both forms (newsletter + fan submission) POST as JSON and show **loading → success / error** states, with inline field errors, honeypot spam trap, toast confirmation, and a `localStorage` backup (`mkbhdhub_submissions`).

Out of the box the site runs in **demo mode**: submissions are validated, "sent" (simulated 900ms), stored locally, and success is shown — so everything is testable immediately.

To receive real emails (choose one):

**Option A — Formspree (recommended, free):**
1. Sign up at formspree.io → New Form → copy endpoint `https://formspree.io/f/XXXX`.
2. In `js/main.js`, set:
   ```js
   const BACKEND = { mode: "formspree", endpoint: "https://formspree.io/f/XXXX" };
   ```

**Option B — FormSubmit (no signup):**
1. In `js/main.js`, set:
   ```js
   const BACKEND = { mode: "formsubmit", endpoint: "https://formsubmit.co/ajax/you@example.com" };
   ```
2. Submit once → click the activation email FormSubmit sends you → future submissions land in your inbox.

Verify: open DevTools → Network → submit the form → confirm the POST → check inbox + `localStorage`.

## Design decisions
- **Creator: Marques Brownlee (MKBHD).** Chosen for his clean, minimal, quality-first identity — it maps perfectly to a premium dark UI (matte black `#08080a`, signature red `#E8322A`, off-white), unlike louder creator brands.
- **Type:** Space Grotesk (display, techy) + Inter (body, readable) — mirrors MKBHD's crisp on-screen titles.
- **Consistency:** one CSS file, one button/card/form language, identical header/footer on all 3 pages; 4/8-pt spacing scale.
- **A11y/perf:** skip link, focus rings, aria-live form status, semantic HTML, lazy images, preconnect, no frameworks (~15KB CSS+JS).

## Disclaimer
Fan-made tribute. Not affiliated with or endorsed by Marques Brownlee / MKBHD. All video/channel links point to the official channels.
