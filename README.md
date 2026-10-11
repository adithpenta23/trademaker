# TradeMaker

**Quote confidently. Know your costs. Protect your profit.**

**Live:** https://trademaker.pages.dev

TradeMaker is a browser-based quoting and job-profitability tool for independent tradespeople and small crews — pressure washers, painters, window cleaners and landscapers. It answers three questions before a quote goes out:

1. **What should I charge the customer?**
2. **What will this job cost my business?**
3. **How much profit and margin will I make if I accept it?**

It runs entirely in the browser. There is no account, backend, database, cookie, analytics or browser storage. Data lives in memory while the tab is open and leaves the app only when you export it.

---

## Features

**Quote builder** (the main screen)
- Quote details: editable quote number (generated per session), title, dates, validity or a fixed expiry date, planned job date, duration, job category, scope, exclusions, payment terms, deposit, acceptance instructions, and customer-facing and internal notes.
- Customer details, with optional email validation and copying addresses between billing and service. Job location notes (gate codes, access) are internal and never printed.
- Line items you can add, edit, duplicate, reorder with up/down buttons, and delete with undo. Each has a name, description, category, quantity, unit (including custom units), price, item discount, taxable flag, and visibility:
  - **Included**: shown and charged.
  - **Optional extra**: shown, not in the total.
  - **Internal only**: never shown or charged, but its costs count.
- Internal costs per item: labor hours × crew (optionally per unit), cost per unit, materials, equipment, travel and other. Job-level costs (disposal, permits, hire, subcontractors) and non-billable labor (setup, travel time) are entered separately and counted once.
- Three pricing modes:
  - **I set prices**: manual.
  - **Target margin**: price = cost ÷ (1 − margin).
  - **Markup on cost**: price = cost × (1 + markup).

  In cost-based modes each line is **Auto** (priced from costs) or **Manual** (kept as typed until you switch it back).
- Minimum job charge, shown as its own explained line on the quote. Percentage or fixed discounts with a reason. Tax: none, added on top, or included in prices, with up to 5 named components (independent or compounded). Deposit as a percentage or fixed amount.
- **Live profit panel**, internal only. Shows the customer total, revenue excluding tax, direct costs with breakdown, allocated overhead, estimated profit after overhead, margin, markup, direct profit before overhead, labor hours, effective hourly rate, profit per labor hour, deposit and balance. Also:
  - A margin meter against your target.
  - A "where the price goes" bar.
  - Status shown with colour, icon and text: on target, below target, low margin, loss, check inputs.
  - When below target, the revenue needed for your target margin and an explicit **Price from costs at X% margin** action.
- **Live customer preview**, rendered at true page size and scaled to fit, with Fit/100% zoom. Customisable: brand colour, logo, footer text, document title (Quote/Estimate/Proposal), and show/hide for scope, descriptions, quantities, tax breakdown, payment terms, exclusions, notes, acceptance and signature.

**Export and print**
- **Download PDF**: a genuine client-side PDF (jsPDF + jspdf-autotable) with an embedded font (Inter, subset to Latin, Latin Extended, Vietnamese, Greek, Cyrillic, punctuation and currency symbols). The table header repeats on every page, rows never split, totals and the signature block are kept together, and every page has a footer with "Page X of Y". A4 or US Letter (automatic by locale, or set in the profile).
- **Print / Save as PDF**: a print stylesheet that prints only the customer document, with repeated table headers and page numbers in Chromium-based browsers. Ctrl/Cmd+P on a quote prints the quote, not the app.
- If a quote contains characters the embedded PDF font can't draw (e.g. CJK), you're warned and pointed to Print / Save as PDF. Logo problems are reported too.

**Templates and trade presets**
- Three editable starter templates: **Standard Service**, **Detailed Project** (labor, materials, equipment, prep, exclusions, milestones, 30% deposit) and **Premium Package** (core service, upgrade and optional extras). Create a quote from a template, edit, duplicate, delete your own templates, or reset the starters. Quotes are deep copies, so template edits never change existing quotes.
- Editable item libraries and example pricing for **pressure washing, painting, window cleaning and landscaping**. Add library items to any quote. All example prices are labelled as demonstration values.

**Everything else**
- **Dashboard**: session quote count, combined quote value (labelled as quote value, not revenue), combined estimated margin, quotes below target, recent quotes, shortcuts, and demo/reset controls.
- **Quotes**: search by number, customer or title; filter by trade or profitability; sort by date, customer or total; open, duplicate, PDF, print, export JSON or delete (with confirmation and undo).
- **Business profile**: name, logo (validated, resized locally, never uploaded), contact details, brand colour, footer, trade, region, currency, number locale, date format and paper size.
- **Pricing settings**: defaults for new quotes, covering labor cost and basis (fully burdened or wages only), crew, pricing mode, target margin, markup, minimum acceptable margin, overhead method, minimum charge and basis, travel charge, discount type and warning level, tax, deposit, validity, terms, document title and quote numbering.
- **Data & backup**: versioned JSON export (complete backup, quotes and templates, or a single quote) and validated import with **Replace** or **Add to session (merge)**.
- **First run**: a skippable two-step setup, **Load demo** ("Evergreen Exterior Care", clearly marked as fictional sample data), or **Restore a backup**.
- Responsive from phone to wide desktop. On wide screens the editor and preview sit side by side; on smaller screens there are Edit / Preview / Profit tabs plus a sticky profit bar.

## Tech stack

- React 19 + TypeScript (strict) + Vite 8 — static single-page app.
- Plain CSS with design tokens; fonts bundled locally via `@fontsource-variable` (Manrope for the UI, Inter for customer documents).
- `lucide-react` icons. `jspdf` + `jspdf-autotable` for PDFs, lazy-loaded and pre-warmed when the app is idle.
- Vitest + Testing Library (jsdom) for tests; ESLint (typescript-eslint, react-hooks).
- No state library (a `useReducer` store), no router library (a small hash router), no validation library (small combinators in `src/io/validate.ts`).

## Getting started

Requires Node.js 22.12+ (or 24+). The toolchain is pinned so a clean `npm ci` installs without engine warnings on Node 22.12.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the production build locally (http://localhost:4173) |
| `npm run typecheck` | TypeScript project build (app, tests, config) |
| `npm run lint` | ESLint |
| `npm test` | Run all tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run check` | typecheck + lint + test + build |

To inspect generated PDFs, set `PDF_OUT` to an existing folder when running the PDF tests: `PDF_OUT=/tmp/pdfs npx vitest run src/pdf`.

## Deploying

### Cloudflare Pages (current production)

Production runs on Cloudflare Pages at **https://trademaker.pages.dev**: Cloudflare's own HTTPS domain, with HTTP redirected to HTTPS. The Pages project is `trademaker`, configured in [`wrangler.toml`](wrangler.toml), and `main` is the production branch.

```bash
npx wrangler login     # once per machine
npm run deploy         # typecheck + lint + tests + build, then deploy dist/ to production
```

Each deploy also gets an immutable preview URL (e.g. `https://<hash>.trademaker.pages.dev`).

[`public/_headers`](public/_headers) sends these security headers on every response:
- A strict Content-Security-Policy: own origin only, no third parties, no framing.
- HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- A locked-down `Permissions-Policy`, plus COOP/CORP.
- Long-term immutable caching for the content-hashed files in `/assets/`.

**Adding your own domain.** Open the Cloudflare dashboard → **Workers & Pages** → `trademaker` → **Custom domains** → **Set up a custom domain**. A subdomain such as `quotes.example.com` can be connected with a CNAME at any DNS provider. An apex domain (`example.com`) needs the domain's DNS on Cloudflare. Certificates are issued automatically.

> This project uses classic Cloudflare Pages, created with `wrangler pages project create --force`, because it provides the `pages.dev` address. Newer wrangler versions otherwise route Pages commands to Workers, which serves from the account's `workers.dev` subdomain instead.

### Any other static host

`npm run build` produces a fully static `dist/` folder with relative asset paths (`base: './'`). Upload it to any static host: Netlify, Vercel, GitHub Pages, S3 + CloudFront, or an nginx/Apache folder. There are no server routes. Navigation uses the URL hash, so no rewrite rules are needed. Replicate the headers from `public/_headers` in your host's configuration.

The production `index.html` also includes a Content-Security-Policy meta tag, so the policy applies even on hosts that don't send headers. After the first load, the app works without a network connection; the PDF engine is pre-loaded in the background.

## How the numbers are calculated

All calculations live in one pure, tested module, [`src/domain/calc.ts`](src/domain/calc.ts). The same results drive the editor, profit panel, preview, PDF, dashboard and exports.

**Money handling.** Inputs are decimals of up to 4 places. They are converted to integers through their decimal string form, and every multiplication and division uses `BigInt`. Results are integer minor units (cents, or whole units for JPY). Rounding is **half-up** and happens once per line amount, discount, tax component and deposit. Automatic prices round **up**, so they never fall short of a target. Amounts beyond about 100 billion fail safely with a message.

**Pipeline**
1. **Line costs**: labor = hours × crew × labor cost rate (× quantity when "per unit"). Cost per unit × quantity goes to the bucket matching the line's category (e.g. a Materials line counts as materials, a Service line as "other direct costs"). Materials, equipment, travel and other are added as entered. Optional lines don't count toward job cost; internal lines do.
2. **Direct job cost** = line costs + job-level costs + non-billable labor.
3. **Allocated overhead** is one of: none, a fixed amount per job, an amount per labor hour, or a percentage of **direct cost**. Percentage-of-price is deliberately not offered because it would be circular. **Total estimated job cost** = direct + overhead.
4. **Prices.** In manual mode, the typed prices are used. In cost-based modes, required revenue (excl. tax) = total cost ÷ (1 − margin), or total cost × (1 + markup). Revenue from manually priced lines is subtracted. The rest is split across auto-priced lines in proportion to their direct cost, or their current prices if none have costs. Unit prices use whole cents unless that overshoots by more than 0.5%, which lets per-sq-ft rates like $0.125 stay exact. Optional extras are priced from their own direct cost plus their variable overhead.
5. **Line amount** = quantity × unit price; an item discount is a percentage of that.
6. **Items subtotal** = sum of included lines after item discounts.
7. **Quote discount and minimum charge**, in the chosen order:
   - *After discounts* (default): subtract the discount (capped at the subtotal), then top up to the minimum.
   - *Before discounts*: top up first, then discount.

   The minimum applies only when the quote has at least one included item. The adjustment appears as its own line with an explanation. Item prices are never changed. The discount and adjustment are shared between taxable and non-taxable items in proportion to their amounts.
8. **Tax** applies to the taxable part of that subtotal.
   - *Exclusive*: each component is rounded and added. Components are either independent (same base) or compound (each on base + earlier taxes).
   - *Inclusive*: tax already inside the prices is extracted (base = amount ÷ factor) and never added again. Any rounding difference goes to the largest component so the parts sum exactly.
9. **Total**, and **revenue excl. tax** = total − tax. Collected tax is never treated as revenue or profit.
10. **Deposit** = percentage of the tax-inclusive total (half-up) or a fixed amount capped at the total. **Balance** = total − deposit. The deposit is part of the total, not an extra charge.
11. **Profit and ratios**
    - Estimated profit after overhead = revenue excl. tax − total job cost.
    - **Margin** = profit ÷ revenue. **Markup** = profit ÷ cost. They are not interchangeable: a 40% margin on a cost of 100 needs a price of 166.67, while a 40% markup gives 140.
    - Direct gross profit (before overhead) is shown separately.
    - Effective hourly rate = revenue ÷ labor hours; profit per labor hour = profit ÷ labor hours.
    - Undefined ratios (no revenue, no cost or no hours) show "—" instead of dividing by zero.

**Status thresholds** are configurable per quote, with defaults in Pricing settings:
- *On target*: margin ≥ target. Green.
- *Below target*: between the minimum acceptable margin and the target. Amber.
- *Low margin*: below the minimum. Red.
- *Loss*: negative profit. Red.
- *Check inputs*: a calculation error. Red.

Margins are compared at the displayed precision (0.1%). A target margin of 100% or more is rejected.

**Labor rate basis.** The labor cost rate is *your cost*, not your billing rate. Choose "fully burdened" (wages + payroll taxes, insurance, benefits) or "wages only". With wages only, cover the extras through overhead.

**Tax.** No legal tax rates are built in. You enter names and rates, and the app reminds you that rules vary by jurisdiction.

All figures are **estimates** based on the costs and assumptions entered. They are not guaranteed results or accounting statements.

## Your data: session-only by design

- Nothing is saved automatically. Refreshing, closing the tab or restarting the browser **clears the session**.
- The top bar shows whether the session has been backed up. The browser asks for confirmation before leaving if there are unexported changes.
- Changing pricing defaults or the business currency never rewrites existing quotes. Each quote keeps a snapshot of its pricing, tax, deposit, terms and currency. Branding (name, logo, colour, footer) is shared across all quotes.

### Backup workflow

1. **Data & backup → Export complete backup** downloads `<business>-full-backup-<timestamp>.json`.
2. Next time, open TradeMaker and choose **Restore a backup** on the welcome screen, or go to **Data & backup → Import**.
3. Choose how to import:
   - **Replace this session**: replaces the business profile, settings, presets, templates and quotes. Asks for confirmation first.
   - **Add to session (merge)**: adds quotes and templates and keeps your current profile and settings. Identical items are skipped, items whose IDs clash get new internal IDs, and duplicate quote numbers are reported.

Backups are versioned (`format: "trademaker-backup"`, `schemaVersion: 1`). Imports are treated as untrusted:
- Size-limited to 10 MB and parsed with `JSON.parse` (never executed).
- Checked by schema version: newer versions are rejected, and older versions go through a migration hook.
- Rebuilt field by field with range checks: numbers, currency codes, locales, dates, IDs, enums, text lengths and logo data URLs (PNG/JPEG/WebP only).
- Duplicate IDs are rejected and unknown properties are dropped. Errors name the exact field, e.g. `quotes[0].lineItems[2].quantity`.

Backups can contain customer names and addresses, so store them as carefully as any customer record.

## Testing

```bash
npm test
```

**`src/domain/calc.test.ts`** covers the engine:
- Basic job, labor and materials, per-unit labor, overhead (all methods), job-level costs.
- Target margin, markup, margin ≠ markup, and manual prices below target.
- Automatic pricing: proportional split, manual overrides, overhead recovery, sub-cent rates, no shortfall from rounding, tax-inclusive gross-up, optional extras.
- Minimum charge, both bases, and no minimum without items.
- Fixed and percentage discounts, discounts larger than the subtotal, item discounts.
- Exclusive, inclusive, independent and compound tax; taxable vs non-taxable items.
- Deposits.
- Zero-cost, negative-profit and empty quotes; impossible margins; invalid numbers; decimal rounding; zero-decimal currencies; optional and internal lines; out-of-range amounts.

**Other test files**
- `src/io/backup.test.ts`: export/import round trips (full, quotes, single quote), invalid JSON and non-backup files, newer schema versions, field-level validation errors, unsafe logos, duplicate IDs, unknown-property stripping, merge collision handling.
- `src/state/reducer.test.ts`: duplication shares no mutable state, sequential numbering, template edits don't touch existing quotes, settings changes don't rewrite quotes, starter template rules, unsaved-change tracking.
- `src/domain/customerDocument.test.ts`: the customer document never contains internal costs, notes, margins or internal lines; it shows minimum-charge explanations and respects show/hide options.
- `src/domain/pricingMode.test.ts`: switching pricing modes is explicit and never silently changes prices.
- `src/pdf/exportPdf.test.ts`: a real PDF is produced; long quotes paginate; every demo quote renders; unsupported-character detection; safe file names.
- `src/format/format.test.ts`: currency, date and percent formatting; locale-aware number parsing.
- `src/test/app.smoke.test.tsx`: renders the real app (jsdom) and covers:
  - First run, creating a quote, editing and reordering lines, checking displayed totals.
  - The preview excluding internal data, printing and JSON export.
  - Navigating every section, the demo, search and full backup export.
  - Clearing the session, rejecting a malformed file, and importing a backup with replace confirmation.

There is no browser-automation suite (e.g. Playwright) in the project. Behaviour was additionally checked by hand in Chromium at desktop and phone widths.

## Project structure

```
src/
  domain/      types, money (exact arithmetic), calc engine, customer document model,
               quote/template factories, pricing-mode switching, dates, limits
  data/        defaults, regions/currencies/labels, trade presets, starter templates, demo
  io/          JSON backup format + validation, file helpers (download, logo processing)
  pdf/         PDF generator, embedded Inter subset (OFL), glyph coverage table
  format/      Intl formatting and locale-aware number parsing
  state/       reducer (session state), store context + actions, hash router
  ui/          buttons, form fields, cards/callouts, toasts + confirm dialog, menu
  features/    dashboard, editor (line items, sections, profit panel), document
               (preview, print), quotes, templates/presets, settings, data, onboarding, shell
  styles/      tokens, base, app, customer document + print
```

## Current limitations

- **No persistence.** Data is lost on refresh or close unless exported. This is intentional for this release.
- **Single user, single device.** No accounts, sync, sending quotes, online acceptance or payment tracking. Because everything runs client-side, a real subscription or paywall can't be enforced. The domain, engine and backup format are kept separate from the UI so a backend could be added later.
- **PDF font coverage.** The embedded font covers Latin, Latin Extended, Vietnamese, Greek and Cyrillic scripts plus common currency symbols. Other scripts (CJK, Arabic, Devanagari…) trigger a warning; use **Print / Save as PDF**, which uses the browser's fonts.
- **Print page numbers** use CSS `@page` margin boxes, supported in Chromium-based browsers. Other browsers print without page numbers (the downloaded PDF always has them).
- **Example prices** in presets, templates and the demo are demonstration values, not market rates. They are written at the scale of USD/GBP/EUR-like currencies and are not converted for other currencies.
- **Rounding of automatic prices** follows the rules above. There's no "round to a nice number" option yet; adjust any price manually and it stays fixed.
- Sharing a draft through a URL is not implemented, to avoid putting customer data in links.

## Licence notes

The bundled Inter font files in `src/pdf/fonts/` are under the SIL Open Font License (`src/pdf/fonts/OFL.txt`). Manrope and Inter web fonts come from the `@fontsource-variable` packages (OFL).
