# MKBHD Hub — Fan-made Tribute Site for Marques Brownlee

Premium, dark-mode, mobile-first fan site. Plain HTML/CSS/JS — zero build step, zero bloat.

**Live site:** [mkbhd-site.vercel.app](https://mkbhd-site.vercel.app)

## Pages
| File | Route | Contents |
|---|---|---|
| `index.html` | Home | Hero, stats, featured videos/series, trust panel, community quotes, **newsletter form**, CTA |
| `about.html` | Story | Ethos panel, 2008→2026 timeline, CTA |
| `community.html` | Community | Highlights grid, **blind-test poll**, **fan submission form**, **fan wall** |
| `privacy.html` | Privacy | Data-use details and a control to clear this browser's saved entries and poll choice |

## Interactive features
- **Smartphone Awards countdown** (Home) — live ticking timer to Dec 18 2026, flips to a "watch now" state after the drop.
- **Filterable video grid** (Home) — All / Reviews / Auto Focus / Podcast / Extras chips, instant client-side filtering.
- **Auto latest-upload player** (Home) — YouTube `user_uploads` embed that always shows MKBHD's newest video.
- **Animated stat counters** (Home) — count up on scroll, respects `prefers-reduced-motion`.
- **Shared blind camera-test poll** (Community) — server-backed vote totals, with a private browser cookie to change or remove your vote.
- **Fan wall** (Community) — form submissions appear instantly from the local backup (XSS-escaped rendering).
- **Privacy and data controls** (Privacy) — see what is stored and clear this browser's local and server-side entries and vote.
- **Scroll-reveal animations + back-to-top button** (all pages, progressive enhancement — content visible without JS).

Shared system: `css/styles.css` (tokens, header/footer, buttons, cards, forms), `js/main.js` (nav, toast, forms).

## Run locally
The static pages work by opening `index.html` or serving the folder. Server-backed forms and poll require `vercel dev` and a configured Supabase project:

```powershell
# Python (any of these)
python -m http.server 8080 --directory "D:\Santhosh K\mkbhd-site"
# then open http://localhost:8080

# OR Node (static pages only)
npx serve "D:\Santhosh K\mkbhd-site"

# Vercel CLI runs both the static site and API routes locally
vercel dev
```

## Deploy (pick one, ~2 min)
- **Netlify:** drag the `mkbhd-site` folder onto app.netlify.com/drop → live URL instantly.
- **Vercel:** deployed at [mkbhd-site.vercel.app](https://mkbhd-site.vercel.app). The connected Vercel project automatically deploys pushes to `main`.
- **GitHub Pages:** publish the repository root from the `main` branch in the repository's **Settings → Pages**.

## Server backend setup (Supabase)

Vercel API routes store newsletter signups and fan submissions privately in Supabase and serve shared poll totals. Form rows are not publicly readable and are not emailed. Newsletter and submission email delivery is not configured.

1. Create a Supabase project.
2. In its SQL Editor, run [`database/schema.sql`](./database/schema.sql) to create the private tables and poll-count function.
3. In the Supabase project settings, copy the project URL and `service_role` key.
4. In Vercel, open the `mkbhd-site` project → **Settings → Environment Variables**. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for **Production** (and Preview if desired). Never put the service-role key in client-side files or commit it to Git.
5. Redeploy the latest production deployment in Vercel so the functions receive the variables.

Until these variables and the schema are configured, server API requests return an explicit error; forms and poll votes do not claim to have succeeded. The site keeps a local form recovery copy. Use the Supabase Table Editor to review private form records. The Privacy page removes this browser's server submissions and vote as well as its local copy.

The poll uses an HTTP-only random cookie to let a visitor change or remove one vote per browser. Clearing the cookie allows a new browser identity. The database stores a hash of that cookie.

## Design decisions
- **Creator: Marques Brownlee (MKBHD).** Chosen for his clean, minimal, quality-first identity — it maps perfectly to a premium dark UI (matte black `#08080a`, signature red `#E8322A`, off-white), unlike louder creator brands.
- **Type:** Space Grotesk (display, techy) + Inter (body, readable) — mirrors MKBHD's crisp on-screen titles.
- **Consistency:** one CSS file, one button/card/form language, shared header/footer across all pages; 4/8-pt spacing scale.
- **A11y/perf:** skip link, focus rings, aria-live form status, semantic HTML, lazy images, preconnect, no frameworks (~15KB CSS+JS).

## Disclaimer
Fan-made tribute. Not affiliated with or endorsed by Marques Brownlee / MKBHD. All video/channel links point to the official channels.
