# AntiSlopUI Pre-Delivery Audit: warehouse-ui

Skill: `antislop-design` (SKILL.md + `references/dashboards.md` §0, `references/slop-uiux-patterns.md` section index).
Mechanical check: `python <skill>/scripts/audit.py src index.html` -> `0 violation(s) across 22 file(s)` (2026-11-27).
`scripts/validate.py` checks the skill repository's own structure (frontmatter, CSVs), not a target app, so it does not apply here.
Research step (`ui-ux-pro-max/scripts/search.py`) skipped: colour and type come from the SKILL.md domain tables, which take precedence.

Decisions recorded:
- Brand hue: `#B45309` clay, from the domain table row "Safety, urgency, logistics, alerts" (warehouse = logistics). Dark theme uses `#F59E0B`, the same clay family lightened for contrast on `#1C1917`.
- Semantic hues: green `#15803D` = free, red `#B91C1C` = occupied, used only for slot state (and LOAD/UNLOAD badges, toasts, battery). Everything else is warm grey (stone).
- Type: Bricolage Grotesque 600 (display, "Software / data product" row) + Inter 400/500/600 (body). Two families, three weights.
- `NO-BRAND`: no product name was supplied, so the wordmark is the descriptive "Warehouse Console". No logo was invented.
- `NO-PROOF`: no testimonials, customer logos or marketing metrics anywhere. All numbers come from the API.
- Light theme `depot` and dark theme `depot-dark`. Both checked for contrast (below). Dark follows `prefers-color-scheme` and has a manual toggle.

## Colour and type
| Item | Result | Evidence |
|---|---|---|
| No banned purple/indigo | PASS | `audit.py` accent-hex / accent-tailwind: 0 hits. Theme in `tailwind.config.js` |
| No gradient text; at most one gradient | PASS | No `bg-clip-text`. The only gradient is the `.hatch` repeating stripe for transfer point A1 (`src/index.css`): a texture, not decoration |
| Display face not Inter/Geist; ≤3 weights; scale | PASS | `index.html` font link: Bricolage 600, Inter 400/500/600. Sizes xs/sm/base/lg/xl/2xl/5xl |
| Body contrast 4.5:1, UI 3:1 (light and dark) | PASS | Computed (WCAG luminance, sRGB approximation of the theme hexes): free label on free cell 5.73, occupied label on occupied cell 6.34, muted 70% on base-200 6.19, muted 60% on white 4.59, white on clay 5.02, white on red bar 6.47. Dark: free 8.95, occupied 6.06 |

## Layout and components
| Item | Result | Evidence |
|---|---|---|
| Container widths / padding vary; full-bleed break | PASS | Map/dashboard/users `max-w-6xl`, shuttle `max-w-3xl`, forbidden/404 `max-w-prose`. Full-bleed: login split (hatched left panel) and full-width header/footer bars |
| No repeated identical 3-col grid; one dominant element | PASS | Map: the 5×5 grid dominates. Dashboard: a 2×2 occupancy tile leads an asymmetric stat grid, then the chart, then a 7/5 split. Users: table + 18rem form rail |
| Radius is a scale | PASS | badges `rounded-sm`, inputs/buttons `rounded-md` (`--rounded-btn`), cards/tables `rounded-lg`, dialogs `rounded-xl` |
| No scaling hover, no glass, no emoji | PASS | `audit.py` hover-scale / backdrop-blur: 0. DaisyUI `--btn-focus-scale: 1`, `--animation-btn: 0`. Icons are inline SVG (`src/components/Icons.tsx`) |

## Copy
| Item | Result | Evidence |
|---|---|---|
| No hype / generic CTA / placeholder / lorem / TODO | PASS | Buttons say what they do: "Load pallet", "Unload to A1", "Create user", "Save password". `audit.py` lorem: 0 |
| Metrics real or labelled | PASS | Every number is API data. Seeded history rows are labelled "Sample" in `history-table`, and the caption says so |
| Sample content labelled | PASS | "Sample" source column + `history-definition` caption (`src/pages/DashboardPage.tsx`) |

## Code-level findings (P0)
| Item | Result | Evidence |
|---|---|---|
| Landmarks + `lang` | PASS | `index.html` `lang="en"`. `Layout.tsx`: `<header>`, `<nav aria-label="Primary">`, one `<main>`, `<footer>`. Login page has its own `<main>` (no shell) |
| Real controls | PASS | Grid cells are `<button>` with `aria-pressed`. `audit.py` fake-button: 0 |
| Overlays are `<dialog>`, close on Escape | PASS | `src/components/Modal.tsx` uses native `showModal()`. `onCancel` closes on Escape unless a request is pending. Mobile drawer closes on Escape and on backdrop click |
| Custom inputs follow ARIA pattern | N-A | Only native `<select>` and `<input>`. No custom combobox |
| Icon-only controls have `aria-label` | PASS | Menu toggle, theme toggle, sign-out (on mobile), dialog close, toast dismiss: all labelled |
| No secrets; no unsafe HTML | PASS | `audit.py` unsafe-html: 0. No keys in source. API base URL comes from env. Token is a runtime value in localStorage (accepted risk, SPEC §10.1) |
| Data fetching idiom | PASS | TanStack Query everywhere (`src/api/hooks.ts`). The only effect-based fetch is the one-off `/auth/me` re-validation on boot |

## Motion and accessibility (HIGH)
| Item | Result | Evidence |
|---|---|---|
| Images carry `alt` | N-A | No `<img>`. Decorative SVGs are `aria-hidden`, and the chart has `role="img"` + `aria-label` + a data table |
| Visible focus | PASS | Global `:focus-visible` 2px primary outline (`src/index.css`) plus DaisyUI input focus rings |
| Form labels | PASS | Every input sits inside a `<label>`. Search fields use `sr-only` labels |
| Validation states | PASS | `aria-invalid`, `aria-describedby`, `input-error` styling, `field-error-*` text (load dialog, user forms) |
| Colour never sole indicator | PASS | Each cell shows its code, a state word (Free/Occupied/Transfer) and an icon. A1 also has dashed border + hatching. `aria-label` gives the state |

## Cross-cutting
| Item | Result | Evidence |
|---|---|---|
| Motion within table; reduced motion | PASS | Hovers `duration-150` colour/shadow. Fade-in and drawer slide 200ms, using transform/opacity only. A `prefers-reduced-motion` block in `index.css` disables both. No `transition-all` (`audit.py`) |
| Contrast (C7) | PASS | See the contrast row above |

## Gestalt
| Item | Result | Evidence |
|---|---|---|
| Tell count | PASS | 0 P0 tells, 0 HIGH tells found |
| Logo-swap test | N-A | `NO-BRAND` recorded. The layout is still product-specific: hatched A1, a floor-plan grid with row/column rulers, and a "Unload to A1" flow |

## Dashboard principles (`references/dashboards.md` §0, guidance only)
Cards use borders, not shadows (shadow only on hover for map cells, toasts and dialogs). `tabular-nums` (`.num`) on all data. One accent colour. The sidebar is muted, and the active link gets a subtle primary tint plus a primary icon (no left-border active state). Loading, error, empty and zero states all exist (`States.tsx`). The chart renders 0 and shows missing days as dashed gaps.

## Responsive verification (built-in browser, live API)
- 375×812: `document.documentElement.scrollWidth === 375` on map, pallets and dashboard. Map cells are about 54px wide. The nav is hidden until `nav-menu-toggle` opens the drawer.
- 1024 px desktop: the sidebar is shown and the detail panel sits below the grid. At `xl` and wider it sits beside the grid.
- Not separately measured: 768 and 1440 widths (UNVERIFIED, non-blocking).

## Revision 2026-11-27: tables, pagination, collapsible sidebar, add-user modal

Re-audited after a UI pass on the map, pallets/log, dashboard and users tables (`antislop-design` re-loaded; `references/dashboards.md` §2 Sidebar and §9 Data table followed).

| Item | Result | Evidence |
|---|---|---|
| Data table pattern (semantic `<table>`, divider rows not zebra, sticky header, `role="region"` + `tabindex=0` scroll) | PASS | `src/components/DataTable.tsx` `TableRegion`; `.data-table` in `src/index.css` |
| Pagination: numbered + prev/next, current page `aria-current`, rows-per-page select labelled | PASS | `Pagination` in `src/components/DataTable.tsx`; used on Users, Pallets, Operations, Stored pallets |
| Collapsible sidebar: `w-56 ↔ rail`, icons always visible, labels kept as `sr-only` + tooltip, width switches instantly (no animated width), preference persisted | PASS | `src/components/Layout.tsx` (`wms.sidebar` in localStorage, `aria-expanded` toggle) |
| Overlay is native `<dialog>`, closes on Escape | PASS | Add-user modal reuses `src/components/Modal.tsx`; Escape closed it in a browser check |
| Colour never the only cue | PASS | Load/Unload badge has ↓/↑ glyph + word; user status badge has text; location chips show the code |
| Numbers/codes never wrap mid-token at 375 px | PASS | `.data-table td.num { white-space: nowrap }`; 375 px check: `scrollWidth` 375 (no page scroll) |
| `audit.py src index.html` | PASS | `0 violation(s) across 23 file(s)` |
| 768 / 1440 px widths | UNVERIFIED | Checked at 375 px and the default pane width only |
