# Craftwork Design System & Quality Guidance for Builder AI

> Upstream Source: `craftwork-design` (`@craftwork-design/wizard@latest`)
> Retrieval Date: 2026-11-03
> Target Runtime: Builder AI React, Tailwind CSS, Lucide React, and Sandpack Client
> Scope: Pure design intelligence, taste rules, typographic discipline, layout structures, micro-interactions, and anti-AI tells.
> Note on MCP Tools: Craftwork MCP search and asset download tools (`craftwork_find_*`, `craftwork_download_*`) require an external authenticated MCP server connection and are not integrated into autonomous code generation. This runtime guidance provides the complete, authoritative design rules that guide model generation across all stages.

---

## 1. The Design Read & Archetype Dials

Before planning or writing code, declare an intentional design read:
- **Design Read**: `<page kind> for <audience>, in a <style family> language, with <key visual device>`.
- **One Idea Motif**: Identify a signature motif taken directly from the product's domain that layout, labels, and motion repeat (e.g., an audio workspace repeats waveform frequencies and playback scrubbers; a logistics platform repeats tracking waypoints and route telemetry).
- **Page Mode**:
  * **Typical Page** (SaaS, developer tool, app, e-commerce, directory, agency): Content and genre lead. The primary visual is the product itself: a live interactive component, a clean UI mockup, bold typography, or structured cards.
  * **Material-Led Piece** (poster-like event, boutique capsule, creative portfolio, editorial): One strong visual family carries the page with expressive display typography (64-120px) and asymmetrical layout breaks.
- **Three Core Dials (1-10)**:
  * **Variance** (1 = strict grid symmetry, 10 = asymmetrical / editorial). A centered hero is acceptable up to variance 6; above 6, use split, left-aligned, or staggered layouts.
  * **Motion** (1 = static, up to 4 = micro-interactions and hover transitions, 5-6 = smooth scroll reveals and animated state demos, 7+ = ambient cinematic effects).
  * **Density** (1 = spacious gallery, 10 = data-dense cockpit). Above 7, drop heavy card containers, separate items with subtle hairlines, and use monospace or tabular numbers.

| Archetype / Brief | Variance | Motion | Density |
| :--- | :--- | :--- | :--- |
| Modern SaaS / Product Landing | 4 | 3 | 4 |
| Agency / Creative Portfolio / Studio | 8 | 7 | 3 |
| Premium Consumer / Boutique Store | 6 | 5 | 3 |
| Event / Drop / Poster-like Site | 9 | 6 | 3 |
| Minimal Editorial / Docs / Publication | 3 | 2 | 3 |
| Dashboard / Analytics / Developer Tool | 2 | 2 | 8 |
| Corporate / Trust-First / Advisory | 2 | 1 | 5 |

---

## 2. Lock One Style and One Theme

A website that mixes contradictory styles reads as generic boilerplate. Once the style is established:
1. **Single Theme Lock**: Maintain one coherent surface family for the entire site. Do NOT inject random light cards into a dark nocturnal site or create random colored card backgrounds. Contrast comes from subtle tone stepping within the palette.
2. **Product Accent Discipline**: The accent color must be derived from the product's domain or brand (about 10% of the visual weight). Reserve it for primary action CTAs, active indicators, and intentional focal points. Never scatter arbitrary bright gradients or random accent colors across every border and card.
3. **Foreign Elements are Defects**:
   - In a clean minimalist site: NO heavy blurred gradient glows or neon cybernetic text.
   - In a neo-brutalist site: NO soft blurred drop shadows or glassmorphism (use hard offset shadows and solid 2px borders).
   - In a dark luxury site: NO flat cartoon stickers or toy illustrations.
   - An effect must use the page's own palette, never introduce an unrelated color scheme.

---

## 3. Harmony Checks for Visual Elements

Every visual element, image, or graphic component must satisfy 5 harmony checks:
1. **Subject**: Depicts the actual product domain or an accepted abstraction (software UI for dev tools, physical objects for e-commerce, architectural spaces for design studios).
2. **Medium**: Exactly one visual medium per page (clean UI components, photography, or vector line art). Never mix clay 3D doodles with realistic photos and sketchy hand-drawn doodles.
3. **Mood**: Energy, temperature, and era match the brief (a calm corporate advisory site must never use neon rave colors; a kids educational site must not look like an industrial terminal).
4. **Scale**: Visual elements must fit their containers naturally. Visuals in a row of cards must share one consistent optical scale.
5. **Palette**: The visual must sit harmoniously on the page background without clashing container boxes or conflicting tints.

---

## 4. Craftwork Taste Rules & Anti-AI Tells

These rules prevent generated websites from looking machine-made:

### Restraint & Visual Discipline
- **One Visual Centerpiece per Section**: Lead with the real product interface or genuine content.
- **Clean Surface Placement**: Screenshots, app windows, and preview panels must sit cleanly on the page background or a token card surface. NO generic floating purple/blue gradient blobs, neon outer glows, or fake metallic bevels behind them.
- **NO Fake Decorative Noise**: NO fake cursors, NO annotation callout chips pinned arbitrarily on images, and NO fake "Scroll to explore" or "Brand · No. 01" micro-text.
- **NO Emoji as Icons**: Always use `lucide-react` SVG icon components.
- **NO Cards Inside Cards**: Avoid nested card boxes. Use clean vertical spacing, subtle background stepping, or thin divider lines.
- **NO Rounded Icon Tiles Over Every Heading**: Do not place a tiny rounded square with an icon above every single section title.
- **NO Rows of 3 Identical Cards**: Avoid the clichéd 3-column identical feature cards. Instead, use varied bento grids (e.g. `col-span-2` for a lead feature with a mini interactive preview, alongside compact companion cards), split image/text rows, or grouped lists.
- **NO Split Section Header Clichés**: Avoid the pattern where the headline sits on the far left and a small floating paragraph floats disconnected on the far right. Group headline and description cleanly.

### Typographic Discipline
- **Typographic Contrast**: Use an intentional font pairing (e.g., expressive display serif or sharp geometric sans for headings, paired with a clean, readable sans for body text).
- **Line Heights**: Headings must use tight line height (1.1 to 1.25); body text must use generous line height (1.5 to 1.6).
- **Letter Spacing (Tracking)**: Large headings use tight tracking (`tracking-tight` or `-0.02em` to `-0.03em`). Small uppercase category badges and metadata use wide tracking (`tracking-wider` or `tracking-widest`).
- **Heading Restraint**: Headings should sit one weight step above body text (medium or semibold, typically `font-semibold` or `font-bold`), maximum 2 lines on desktop. Hierarchy comes from scale, weight, and space, not shouting.
- **Widow & Rag Prevention**:
  * Use `text-wrap: balance` (or CSS `text-wrap: balance`) on all headlines and section titles so no single word dangles alone on the last line.
  * Use `text-wrap: pretty` on short descriptions and callouts.
  * Never leave an orphaned word on its own row.
- **Scale Floors**: Body text must be at least 16px (`text-base`), UI controls at least 14px (`text-sm`), and small caption metadata no smaller than 12px (`text-xs`).

### Color, Borders & Surfaces
- **Single Neutral Family**: Do NOT mix warm greys (stone) with cool blue-greys (slate) on the same page. Pick one neutral family and adhere to it.
- **NO Default Purple/Blue Glows**: Never default blindly to indigo-to-purple gradient text or ambient purple blobs. The accent hue must match the brand.
- **NO Pure `#000000`**: Avoid pure harsh black for body text and background canvases. Use rich charcoal/slate (`#09090b`, `#0f172a`, `#18181b`) or tinted neutrals.
- **Tinted Shadows**: Never use pitch-black drop shadows on light surfaces; tint shadows to the background tone (`shadow-slate-900/5`).
- **One Corner Radius System**: Apply one consistent radius system across the entire project (e.g., modern soft `rounded-xl` for cards with `rounded-lg` for buttons, or sharp `rounded-none` for architectural/Swiss, or pill `rounded-full` for controls).
- **Concentric Nested Corners**: When nesting a rounded element inside a padded container, enforce concentric radii:
  `outer_radius = inner_radius + padding` (e.g., container with `p-4` and `rounded-2xl` holds cards with `rounded-xl`).
- **Mobile Viewport Height**: Full-screen heroes must use `min-h-dvh` or `min-height: 100dvh` (never rigid `100vh`) to avoid mobile browser navigation bar jumps.

### Layout & Composition
- **Hero Fits First Viewport**: The hero must feature at most 4 text elements (optional small category pill, headline, concise subheadline <= 20 words, 1-2 action buttons), with primary CTAs immediately visible above the fold.
- **Hero Visual Centerpiece**: The hero must carry a real visual: a live interactive demo component, a clean product window, a device mockup, or bold display typography.
- **Bento Grids with Purpose**: If using a bento grid, each cell must have varied spans (`md:col-span-2`, `md:row-span-1`), and at least 2 cells must display real interactive variety (a live mini-chart, a toggleable control, or real imagery).
- **Spacious Rhythmic Spacing**: Use an 8px/4px spatial scale. Space between distinct sections must be 64-128px (`py-16` to `py-28`). The space between different sections must be at least 2x the space inside a card.
- **Ultra-Compact Mobile Resilience (<360px)**: Every horizontal button row, search bar, and filter group must wrap gracefully (`flex-wrap gap-2` or `w-full`) to prevent horizontal viewport clipping on small devices.

### States, Micro-Interactions & Hover Polish
- **Visible, Animated Hover on EVERY Interactive Element**:
  * Every navigation link, button, card, and interactive control must have a visible, smooth transition on hover (`transition-all duration-200 ease-out`).
  * Hover states must feel alive: a subtle background fill shift, gentle upward lift (`hover:-translate-y-0.5 hover:shadow-md`), or text color change.
  * **CRITICAL HOVER RULE**: Hover should NEVER simply light up or recolor a border! Change the fill background, text color, position, or shadow instead.
- **One Button Scale**: Establish at most 3 standard button heights across the site (e.g., small 36px, medium 44px, large 48-52px). Buttons placed side by side must share the exact same height and vertical alignment.
- **Tactile Active Press Feedback**: Interactive buttons must include a subtle active press state (`active:scale-[0.98]`).
- **Focus Rings**: All interactive controls must have accessible, visible keyboard focus indicators (`focus-visible:ring-2 focus-visible:ring-offset-2`).
- **Reduced-Motion Support**: Respect user preferences in CSS via `@media (prefers-reduced-motion: reduce)`.

### Copy & Editorial Standards
- **NO Em Dashes (—) or En Dashes (–)**: Never use em dashes or en dashes in headings, badges, or UI text. Use a period, a comma, a colon, or a hyphen.
- **NO Middle Dots (·)**: Do not use middle dots as metadata separators (`price · time · author`). Use clean spacing, subtle vertical dividers, or separate columns.
- **NO Cliched AI Filler Verbs**: Never use empty buzzwords like "elevate", "seamless", "unleash", "next-gen", "revolutionize", or "supercharge". State concretely what the product actually does.
- **Realistic Data & Content**: Use believable, industry-accurate names, metrics, and details. Never invent fake "99.99%" or "10x" claims unless explicitly requested.
- **Action-Oriented Buttons**: Buttons must use a clear action verb plus an object ("Create workspace", "Reserve a table", "Explore collection", "Download brief"), never generic "OK", "Submit", or "Click Here".

---

## 5. Builder AI Runtime Integration & Conflict Resolution

When generating or revising websites within Builder AI:
1. **Authoritative Hierarchy**:
   * The user's prompt is paramount.
   * The project's established `DesignSpec` is authoritative for color hex tokens, font families, archetype, and layout structure.
   * Craftwork guidance refines and enforces taste, layout proportions, micro-interactions, typographic rhythm, and anti-AI restraint.
2. **React & Sandpack Client Compatibility**:
   * Global CSS, Google Font `@import`, root variables, and keyframe animations reside in `/styles.css`.
   * Main entry point is `/App.js`. Modular components reside in `/components/`.
   * Icons: Exclusively use `lucide-react` components (`import { ArrowRight, Check } from 'lucide-react'`). Never import external Font Awesome or CDN fonts.
   * React Packages: Client runtime supports `react`, `react-dom`, `lucide-react`, `canvas-confetti`, and `framer-motion`. Never import backend modules (`fs`, `path`, `mongoose`, `express`).
3. **Component Prop Contract Safety**:
   * Parent components (`/App.js`) must explicitly pass configuration objects and handlers to child components (`config={STORE_CONFIG}`, `cart={cart}`).
   * Child components must declare defensive default parameter fallbacks (`config = STORE_CONFIG`, `items = []`) and use safe optional chaining (`config?.freeShippingThreshold`) to prevent runtime TypeErrors.
4. **Single-File Rule for Interactive Tools/Games**:
   * For interactive utilities, calculators, and games (e.g. Tic Tac Toe, Stopwatch, Calculator), implement the complete game logic and UI directly inside `/App.js` and `/styles.css`. Do not scatter state across multiple fragmented component files.

