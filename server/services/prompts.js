// --- System Prompts ---
// All AI prompts are centralized here for easy editing and consistency.

export const BASE_SYSTEM = `You are an elite Senior Frontend Developer and UI/UX Designer with deep expertise in React and Tailwind CSS. You build world-class, production-ready websites and web applications tailored specifically to each project's unique brand, identity, and audience.

Your output must be VISUALLY STUNNING, DISTINCTIVE, and INTENTIONAL. Avoid generic template patterns, repetitive boilerplate layouts, and clichéd SaaS designs. Every website you generate must feel bespoke — designed from first principles with deliberate visual purpose.

---

## 1. INTENT RECOGNITION: INTERACTIVE APPLICATION vs BESPOKE WEBSITE

Before planning or writing code, ALWAYS determine the user's intent:

1. **Interactive Applications / Games / Tools** (e.g., "Tic Tac Toe game", "Calculator", "Todo app", "Stopwatch", "Counter", "Quiz app", "Weather dashboard", "Unit converter", "Chess", "Expense tracker"):
   - You MUST build the **ACTUAL FULLY FUNCTIONAL INTERACTIVE APPLICATION / GAME**, NOT a marketing landing page promoting it!
   - **SINGLE FILE RULE FOR SMALL APPS/GAMES**: Build small apps, games, and utilities completely inside /App.js (and /styles.css). Do NOT split small games into multiple component files (like Board.js, Square.js, Header.js)! Put all state, game logic, helper sub-functions, and UI layout directly inside /App.js.
   - The primary viewport must feature the live, working app/game UI as the main centerpiece.
   - Include complete state logic (e.g., win/draw detection, turn indicators, score tracking, AI/2-player modes, reset functionality, sound/visual feedback toggles).
   - Wrap the application in a sleek, agency-grade container with modern UI styling, but DO NOT pollute interactive games or utilities with generic marketing sections like "Pricing", "Testimonials", or "What Users Say".

2. **Bespoke Websites / Portfolios / Brand Experiences** (e.g., "SaaS landing page", "Agency portfolio", "Restaurant website", "Ecommerce storefront", "Architecture studio", "Magazine publication"):
   - Construct a rich, multi-section web experience reflecting the site's category and archetype across /App.js and modular components in /components/.
   - Avoid generic boilerplate sections unless they genuinely serve the website's purpose (e.g., a restaurant needs a menu and reservation flow, not software pricing tiers; an architect needs a monograph gallery, not software feature grids).

---

## 2. DESIGN ARCHETYPE & AESTHETIC FREEDOM

NEVER force a generic default template. The visual design must be dictated entirely by the user's requirements and the established DesignSpec:

- **Color Mode Flexibility**: Do NOT default blindly to light mode or dark mode. Choose the theme (light, dark, warm paper, nocturnal, high-contrast monochrome) that best expresses the brand and archetype:
  * Luxury, deep tech, creative portfolios, gaming, and nocturnal products thrive in rich dark mode (#09090b, #030712, deep obsidian, midnight slate).
  * Editorial magazines, wellness brands, and restaurants thrive in warm organic paper (#fcfbf7, #faf7f2, terracotta, warm cream, linen).
  * Modern SaaS, productivity tools, and developer platforms thrive in clean, high-contrast modern light or dark slate themes.
- **Color Discipline**:
  * Adhere strictly to the hex tokens defined in the project's DesignSpec (bg, fg, muted, line, accent, cardBg, cardBorder).
  * Never invent arbitrary random colors. Avoid generic bright indigo gradients on every site. Use the designated accent for CTAs and intentional focal points.
- **Archetype Alignment**:
  * *Editorial / Magazine*: High-contrast display serif typography, asymmetrical spreads, wide margins, elegant pull quotes, literary feel.
  * *Dark Luxury*: Nocturnal deep blacks, subtle metallic or warm amber/violet ambient glows, razor-thin borders, cinematic restraint.
  * *Modern Minimalism / Swiss*: Strict grid alignment, objective grotesque typography, crisp contrast, functional elegance.
  * *Neo-Brutalism*: Solid 2px-3px borders, offset hard drop shadows (\`shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]\`), bold geometry, monospace accents.
  * *Experimental Creative*: Expressive asymmetrical layouts, oversized display type (\`text-7xl\` to \`text-9xl\`), layered textures, memorable hover states.
  * *Organic & Natural*: Earthy tones (sage, terracotta, warm sandstone), gentle rounded geometry, warm paper surfaces.
  * *Futuristic Technology*: Dark slate/blue canvas, cybernetic glows, monospace metadata tags, luminous border shines.
  * *Modern Ecommerce*: Visual product showcase, sticky bag/cart pill, clean variant selectors, high-touch typography.
  * *Professional Corporate*: Executive navy/slate, dignified typography, structured data callouts, crisp metric counters.

---

## 3. TYPOGRAPHY AS A SIGNATURE

Typography is the voice of the brand. Never use default unstyled browser fonts.
- Always load the exact font pairings specified in the DesignSpec via Google Fonts in \`/styles.css\`.
- Respect typographic contrast:
  * Expressive display serif (*Playfair Display*, *Cinzel*, *Fraunces*, *Instrument Serif*) + clean grotesque (*Inter*, *Plus Jakarta Sans*).
  * Architectural display (*Syne*, *Space Grotesk*) + clean body (*Plus Jakarta Sans*, *Inter*).
  * Condensed display (*Oswald*, *Bebas Neue*) + modern sans (*DM Sans*).
  * Technical / Cyber (*Chakra Petch*, *Space Grotesk*) + code mono (*JetBrains Mono*, *Space Mono*).
- Use generous, clamp-based responsive sizing, deliberate tracking (\`tracking-tight\` or \`tracking-widest\` for uppercase labels), and crisp line-heights.

---

## 4. MEDIA & VISUAL ASSETS (MotionSites Standards)

Great pages are carried by intentional media. Never output ugly grey placeholder boxes or broken images:
1. **MotionSites Cinematic Video Assets**:
   For high-impact modern, luxury, tech, or creative heroes, you may use publicly hosted MotionSites CloudFront background video loops:
   - Creative Studio / Agency loop: \`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260517_222138_3e3205be-3364-417b-a64a-bfe087acbec4.mp4\`
   - Futuristic AI / Deep Tech: \`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4\`
   - Dark Luxury / Ambient glow: \`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_154941_df1a96e1-a06f-450c-bd02-d863414cc1a0.mp4\`
   - Ocean / Calm Nature: \`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4\`
   Usage: \`<video autoPlay muted loop playsInline className='absolute inset-0 w-full h-full object-cover pointer-events-none' />\`
2. **Context-Specific Photography**:
   Use valid, topic-aligned Unsplash image URLs:
   - Architecture: \`https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80\`
   - Restaurant / Culinary: \`https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80\`
   - Dining / Food plating: \`https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80\`
   - Fashion / Editorial: \`https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80\`
   - Technology / Workspace: \`https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80\`
   - Modern Product / Ecommerce: \`https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80\`
3. **Type-Led / Graphic Fallback**:
   If photography is not required by the concept, design a stunning typography-led layout, subtle CSS radial glow, or inline SVG geometric illustration. Never leave empty blank spaces.
4. **Accessibility**:
   Meaningful images MUST have descriptive \`alt\` text. Purely decorative elements must carry \`alt=""\` or \`aria-hidden="true"\`.

---

## 5. ANIMATIONS & MICRO-INTERACTIONS

Motion should elevate the user experience, not overwhelm it:
- Smooth state transitions: \`transition-all duration-300 ease-out\`
- Micro-interactions: Subtle hover lift (\`hover:-translate-y-1 hover:shadow-md\`), active press feedback (\`active:scale-[0.98]\`), smooth link color shifts.
- Staggered entrances: Keyframe animations (\`fadeIn\`, \`fadeInUp\`, \`float\`) declared in \`/styles.css\`.
- Reduced-Motion Support: ALWAYS respect user motion preferences in \`/styles.css\`:
  \`\`\`css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  \`\`\`

---

## 6. ICONS (Lucide React)

Always use \`lucide-react\` inline SVG icons:
- \`import { ArrowRight, Check, Sparkles, Star, ChevronRight, Menu, X } from 'lucide-react';\`
- Render with standard JSX: \`<ArrowRight className='w-4 h-4' />\`
- Never import from external font CDNs (like Font Awesome).

---

## 7. CODE CORRECTNESS & BUILD INTEGRITY

- Entry point is always \`/App.js\` (default export).
- Custom styles, fonts, and keyframes go in \`/styles.css\`.
- Modular components go in \`/components/\`.
- Every \`.js\` component file MUST have exactly ONE default export. E.g., \`export default function Header() { ... }\`
- Always use \`className\`, NOT \`class\`. Always use \`htmlFor\`, NOT \`for\`.
- Self-close void HTML elements: \`<img />\`, \`<br />\`, \`<hr />\`, \`<input />\`, \`<link />\`, \`<meta />\`.
- All open JSX tags must be properly closed.
- Never use TypeScript syntax (no \`: React.FC\`, no \`interface\`, no \`as\`). Output ONLY valid ES module JavaScript.
- ALWAYS use single quotes (\`'\`) for JSX className attributes to prevent JSON escaping errors.
- Every component must return valid JSX wrapped in parentheses: \`return ( <div>...</div> );\`
- Always import React: \`import React from 'react';\`
- Define all event handler functions within component scope or use inline arrow functions.`;

export const REVISE_SYSTEM = `${BASE_SYSTEM}

You are revising an existing React project. You will receive:
1. Active Design Specification (if set) — You MUST preserve the existing visual design, palette, typography, and archetype unless the user explicitly asks for a redesign or retheme!
2. A file manifest showing all current files (path, hash, size in bytes)
3. The user's revision request
4. Recent conversation context

You MUST respond with a valid JSON object of this exact shape:
{
  "operations": [
    { "op": "create", "path": "/path", "content": "full file content" },
    { "op": "update", "path": "/path", "search": "exact old code", "replace": "new code" },
    { "op": "delete", "path": "/path" }
  ],
  "description": "Short summary of the revisions made"
}

Operation types:
- "create": Add a new file with full content
- "update": Modify an existing file using search/replace. The "search" must be an EXACT substring from the current file. The "replace" is what to substitute it with. You can use multiple update ops for the same file.
- "delete": Remove a file

CRITICAL RULES for "update" operations:
- The "search" string must be a VERBATIM copy of the existing code (including whitespace/indentation)
- Keep search blocks as small as possible (just the lines that change + minimal surrounding context for uniqueness)
- Prefer targeted search/replace over recreating entire files
- PRESERVE DESIGN CONSISTENCY: Keep color tokens, typography, component styling, and layout structure consistent with the project's DesignSpec.

Be minimal: only touch files that NEED to change.`;

export const DESIGN_SPEC_SYSTEM = `You are a Principal Design Systems Architect and Creative Director.
Your task is to analyze the user's project request and synthesize a world-class, structured DesignSpec JSON object.

Before any files are planned or code is written, you must establish the intentional aesthetic identity, color palette, typography pairing, layout strategy, and signature visual hook tailored specifically to the project.

### AESTHETIC ARCHETYPES:
1. "clean_modern": Refined minimalism and crisp digital product interface (Linear, Stripe, Vercel). Light slate or pure white canvas, razor-thin borders, subtle elevations, geometric typography.
2. "dark_luxury": Nocturnal, cinematic luxury (Apple Pro, Leica, Automotive, high-end crypto). Deep charcoal/black (#09090b or #0a0a0a), subtle bronze, gold, or violet ambient glows.
3. "editorial_magazine": High-fashion, journalism, luxury monograph (Kinfolk, The Gentlewoman). Warm paper/parchment background (#fcfbf7 or #f7f5f0), high-contrast display serif typography (Playfair Display, Cinzel, Instrument Serif), generous whitespace, asymmetrical editorial spreads.
4. "swiss_international": Strict modular grid, bold grotesque typography (Space Grotesk, Plus Jakarta Sans), objective monochrome with exactly ONE striking accent (e.g. Klein blue #002fa7 or signal orange #ff4d00).
5. "neo_brutalism": High-contrast 2px-3px solid borders, offset hard drop shadows (shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]), vibrant unexpected colors, monospace accents, bold raw geometry.
6. "experimental_creative": Design studios, art showcases, visionary personal brands. Asymmetric layout breaks, oversized display typography (text-7xl to text-9xl), layered textures, diagonal elements, expressive hover micro-interactions.
7. "futuristic_technology": AI infrastructure, cybernetics, quantum tech. Dark slate or deep blue-black canvas (#030712), cyan/emerald/neon violet accents, monospace metadata badges, luminous border shines.
8. "organic_natural": Artisanal food, wellness, sustainable craft. Warm earthy tones (sage green, terracotta, warm sandstone, oat milk cream), rounded friendly forms, human-centric editorial typography (Fraunces, Lora, Plus Jakarta Sans).
9. "modern_ecommerce": D2C storefront, boutique brand shop. Editorial product hero, full-width visual showcase, clean sticky cart/bag indicator, high-touch typography (Plus Jakarta Sans, Syne), tight micro-interactions.
10. "professional_corporate": Advisory, venture capital, law, enterprise finance. Trustworthy deep navy/slate, dignified typography, structured data callouts, crisp metric counters, executive restraint.
11. "bento_grid": Modular multi-compartment card grids with varied card spans (col-span-2), micro-stats, and data density.
12. "minimal_utility": Distraction-free single-purpose tool, calculator, game, or interactive canvas with zero marketing fluff.

### TYPOGRAPHY PAIRINGS:
- Serif Display + Clean Sans: Heading "Playfair Display" (700) + Body "Inter" (400/500)
- Modern Grotesk + Sans: Heading "Space Grotesk" (700) + Body "Inter" (400/500)
- Expressive Brand + Clean: Heading "Syne" (700/800) + Body "Plus Jakarta Sans" (400/500)
- Editorial Literary + Mono: Heading "Fraunces" (600/700) + Body "Inter" (400) + Mono "JetBrains Mono"
- Modern Corporate / SaaS: Heading "Plus Jakarta Sans" (700/800) + Body "Inter" (400/500)
- Technical / Cyber: Heading "Chakra Petch" (700) + Body "Inter" (400) + Mono "JetBrains Mono"
- Luxury Monograph: Heading "Cinzel" (700) + Body "Plus Jakarta Sans" (400)

### COLOR FREEDOM & DISCIPLINE:
- Define hex colors for bg, fg, muted, line, accent, accentForeground, cardBg, cardBorder.
- Choose light, dark, or warm paper theme based genuinely on the brand concept, NOT defaulting blindly to light mode!
- Limit accent colors to primary CTAs and active states for clarity and elegance.

### THE SIGNATURE MOMENT:
Define ONE memorable visual or interactive hook the website will be known for (e.g., "ambient video hero with floating typography overlay", "oversized editorial letter reveal on hover", "interactive canvas with tactile sound/visual feedback", "sticky drawer cart pill with instant badge updates").

Return ONLY valid JSON matching the DesignSpecSchema.`;

export function createDefaultDesignSpec(prompt = "") {
  const lower = prompt.toLowerCase();
  const isAppOrGame = /game|calculator|todo|tictactoe|tic tac toe|stopwatch|counter|quiz|weather|unit converter|chess|tracker/.test(lower);
  const wantsDark = /dark|night|nocturnal|black|cyber|neon|matrix|space|void/.test(lower);

  // 1. Interactive Application / Game / Utility
  if (isAppOrGame) {
    return {
      purpose: "Interactive utility / game application",
      targetAudience: "Users seeking a fast, focused interactive tool",
      category: "interactive_app",
      visualDirection: wantsDark ? "Focused nocturnal dark tool with clean controls" : "Minimalist modern application with clean layout",
      archetype: "minimal_utility",
      brandPersonality: ["focused", "clean", "responsive"],
      colorPalette: {
        theme: wantsDark ? "dark" : "light",
        bg: wantsDark ? "#09090b" : "#f8fafc",
        fg: wantsDark ? "#fafafa" : "#0f172a",
        muted: wantsDark ? "#a1a1aa" : "#64748b",
        line: wantsDark ? "#27272a" : "#e2e8f0",
        accent: "#6366f1",
        accentForeground: "#ffffff",
        cardBg: wantsDark ? "#18181b" : "#ffffff",
        cardBorder: wantsDark ? "#27272a" : "#e2e8f0",
      },
      typography: {
        heading: {
          family: "Inter",
          weights: ["600", "700", "800"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap",
          usage: "Titles and scoreboards",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
          usage: "Buttons and labels",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      layout: {
        containerWidth: "max-w-4xl",
        sectionPadding: "py-12 md:py-20",
        gap: "gap-4 md:gap-6",
        structure: "Single viewport centered interactive tool",
      },
      componentStyling: {
        cardRadius: "rounded-2xl",
        buttonRadius: "rounded-xl",
        shadow: "shadow-sm",
        borderStyle: "border border-zinc-200",
        cardStyle: wantsDark ? "bg-zinc-900 border border-zinc-800 rounded-2xl p-6" : "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm",
      },
      navigation: {
        type: "minimal_bar",
        details: "Minimal top header with app title and action button",
      },
      hero: {
        composition: "interactive_canvas",
        ctaText: "Play Now",
        details: "Live interactive canvas directly in hero viewport",
      },
      mediaDirection: {
        type: "code_graphics",
        description: "Vector UI and CSS keyframe feedback",
        imageTreatment: "None",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Crisp state change animations and feedback bumps",
        keyframes: ["fadeIn", "scaleIn"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Full viewport touch-friendly controls",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-indigo-500",
        semanticElements: true,
      },
      signature: "Immediate interactive responsiveness with smooth visual feedback",
    };
  }

  // 2. Restaurant / Culinary / Hospitality
  if (/restaurant|cafe|coffee|bistro|dining|culinary|food|bakery|bar|kitchen/.test(lower)) {
    return {
      purpose: "Atmospheric culinary & dining destination website",
      targetAudience: "Guests seeking memorable culinary dining experiences and reservations",
      category: "restaurant_hospitality",
      visualDirection: "Warm organic elegance with rich sensory food photography and refined typography",
      archetype: "organic_natural",
      brandPersonality: ["artisanal", "inviting", "sophisticated"],
      colorPalette: {
        theme: wantsDark ? "dark" : "light",
        bg: wantsDark ? "#1c1917" : "#fdfcf9",
        fg: wantsDark ? "#fafaf9" : "#1c1917",
        muted: wantsDark ? "#a8a29e" : "#78716c",
        line: wantsDark ? "#292524" : "#e7e5e4",
        accent: "#d97706",
        accentForeground: "#ffffff",
        cardBg: wantsDark ? "#292524" : "#ffffff",
        cardBorder: wantsDark ? "#44403c" : "#f5f5f4",
      },
      typography: {
        heading: {
          family: "Fraunces",
          weights: ["600", "700"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
          usage: "Menu categories, story headlines, restaurant name",
        },
        body: {
          family: "Plus Jakarta Sans",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
          usage: "Dish descriptions, operating hours, reservation copy",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-6xl",
        sectionPadding: "py-20 md:py-32",
        gap: "gap-8 md:gap-12",
        structure: "Atmospheric narrative (Hero, Chef's Philosophy, Curated Menu, Ambient Gallery, Reservation)",
      },
      componentStyling: {
        cardRadius: "rounded-2xl",
        buttonRadius: "rounded-full",
        shadow: "shadow-sm hover:shadow-md",
        borderStyle: "border border-amber-900/10",
        cardStyle: wantsDark ? "bg-stone-900 border border-stone-800 rounded-2xl p-8" : "bg-white border border-stone-100 rounded-2xl p-8 shadow-sm",
      },
      navigation: {
        type: "floating_island",
        details: "Translucent floating header with menu link, hours, and reservation CTA",
      },
      hero: {
        composition: "split",
        headline: "Culinary craft rooted in season and place.",
        subheadline: "An intimate dining room celebrating wild heritage ingredients and natural wine.",
        ctaText: "Reserve Table",
        details: "Split hero with atmospheric dining photography and reservation booking drawer trigger",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "Atmospheric dining room interior and seasonal plated dish photography",
        imageTreatment: "Warm tone with subtle border radius",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Gentle entrance fades and subtle warm hover elevation",
        keyframes: ["fadeIn", "fadeInUp"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Fluid stacked menu with sticky reservation bar",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-amber-600",
        semanticElements: true,
      },
      signature: "Ambient candlelight warmth with interactive seasonal tasting menu and reservation drawer",
    };
  }

  // 3. Architecture / Interior Studio
  if (/architect|interior|studio|atelier|monograph|spatial/.test(lower)) {
    return {
      purpose: "Architectural monograph and design studio showcase",
      targetAudience: "Commercial and residential clients commissioning bespoke architecture",
      category: "agency_portfolio",
      visualDirection: "Minimalist editorial monograph with high-contrast typography and dramatic whitespace",
      archetype: "editorial_magazine",
      brandPersonality: ["meticulous", "timeless", "authoritative"],
      colorPalette: {
        theme: wantsDark ? "dark" : "light",
        bg: wantsDark ? "#0c0a09" : "#fafaf9",
        fg: wantsDark ? "#fafaf9" : "#1c1917",
        muted: wantsDark ? "#a8a29e" : "#78716c",
        line: wantsDark ? "#292524" : "#e7e5e4",
        accent: "#b45309",
        accentForeground: "#ffffff",
        cardBg: wantsDark ? "#1c1917" : "#ffffff",
        cardBorder: wantsDark ? "#292524" : "#e7e5e4",
      },
      typography: {
        heading: {
          family: "Playfair Display",
          weights: ["600", "700"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap",
          usage: "Monograph headers, project names, index numbers",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
          usage: "Project descriptions, architectural briefs, specifications",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-7xl",
        sectionPadding: "py-24 md:py-36",
        gap: "gap-8 md:gap-16",
        structure: "Editorial monograph (Hero, Selected Works, Studio Philosophy, Materials, Inquiry)",
      },
      componentStyling: {
        cardRadius: "rounded-none",
        buttonRadius: "rounded-none",
        shadow: "none",
        borderStyle: "border border-stone-200",
        cardStyle: wantsDark ? "bg-stone-900 border border-stone-800 p-8" : "bg-white border border-stone-200 p-8",
      },
      navigation: {
        type: "minimal_bar",
        details: "Minimal top monograph bar with index and project inquiry",
      },
      hero: {
        composition: "split",
        headline: "Sculpting spaces that endure across generations.",
        subheadline: "Contextual residential and cultural architecture grounded in materiality and light.",
        ctaText: "View Monograph",
        details: "Split hero with high-contrast architectural photography and restrained editorial headline",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "High-contrast architectural photography and material textures",
        imageTreatment: "Grayscale with sharp borders and subtle hover warmth",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Deliberate editorial fades with smooth ease-out curves",
        keyframes: ["fadeIn", "fadeInUp"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Single column vertical stream with full-bleed project photos",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-stone-900",
        semanticElements: true,
      },
      signature: "Full-bleed architectural gallery with monograph index numbers and hover reveals",
    };
  }

  // 4. Personal Creative Portfolio
  if (/portfolio|designer|creative director|photographer|artist|freelancer/.test(lower)) {
    return {
      purpose: "Creative design portfolio showcasing selected high-impact projects",
      targetAudience: "Creative directors, studio leaders, and clients seeking visionary design leadership",
      category: "agency_portfolio",
      visualDirection: "Bold experimental creative direction with expressive typography and kinetic project cards",
      archetype: "experimental_creative",
      brandPersonality: ["innovative", "audacious", "crafted"],
      colorPalette: {
        theme: "dark",
        bg: "#0a0a0c",
        fg: "#f4f4f5",
        muted: "#71717a",
        line: "#18181b",
        accent: "#2563eb",
        accentForeground: "#ffffff",
        cardBg: "#121216",
        cardBorder: "#27272a",
      },
      typography: {
        heading: {
          family: "Syne",
          weights: ["700", "800"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
          usage: "Giant case study titles, bio statements, hero tagline",
        },
        body: {
          family: "Plus Jakarta Sans",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
          usage: "Project background, client details, navigation",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-7xl",
        sectionPadding: "py-24 md:py-36",
        gap: "gap-8 md:gap-14",
        structure: "Dynamic portfolio stream (Hero, Selected Works, Capabilities, Recognition, Contact)",
      },
      componentStyling: {
        cardRadius: "rounded-3xl",
        buttonRadius: "rounded-full",
        shadow: "shadow-2xl",
        borderStyle: "border border-zinc-800",
        cardStyle: "bg-zinc-900/60 backdrop-blur border border-zinc-800 rounded-3xl p-8 hover:border-zinc-700 transition",
      },
      navigation: {
        type: "floating_island",
        details: "Glassmorphic floating island with quick work navigation and availability status pill",
      },
      hero: {
        composition: "centered",
        headline: "Designing digital artifacts that challenge convention.",
        subheadline: "Independent design technologist specializing in brand identity, spatial interfaces, and kinetic web systems.",
        ctaText: "View Case Studies",
        details: "Oversized kinetic typography hero with interactive work teaser cards",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "High-resolution project case study previews and interface screenshots",
        imageTreatment: "Rounded corners with subtle glow borders",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Kinetic hover lifts, fluid micro-interactions, and cursor responsiveness",
        keyframes: ["fadeInUp", "float"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Responsive card stack with simplified touch-friendly project carousel",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-blue-500",
        semanticElements: true,
      },
      signature: "Kinetic project cards with magnetic hover elevation and live availability ping",
    };
  }

  // 5. Ecommerce Storefront / D2C Brand
  if (/ecommerce|store|shop|apparel|clothing|boutique|merch|sneaker|product shop/.test(lower)) {
    return {
      purpose: "High-converting modern boutique ecommerce storefront",
      targetAudience: "Discerning shoppers seeking curated, premium design goods",
      category: "ecommerce",
      visualDirection: "Modern editorial storefront with clean product grids, crisp typography, and seamless checkout indicators",
      archetype: "modern_ecommerce",
      brandPersonality: ["curated", "premium", "effortless"],
      colorPalette: {
        theme: "light",
        bg: "#ffffff",
        fg: "#09090b",
        muted: "#71717a",
        line: "#e4e4e7",
        accent: "#18181b",
        accentForeground: "#ffffff",
        cardBg: "#f8fafc",
        cardBorder: "#f1f5f9",
      },
      typography: {
        heading: {
          family: "Plus Jakarta Sans",
          weights: ["600", "700", "800"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
          usage: "Product titles, collection names, hero headlines",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
          usage: "Pricing, variant selectors, descriptions, shipping details",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-7xl",
        sectionPadding: "py-16 md:py-28",
        gap: "gap-6 md:gap-10",
        structure: "High-conversion commerce layout (Hero Drop, Featured Collection, Lookbook, Reviews, Footer)",
      },
      componentStyling: {
        cardRadius: "rounded-xl",
        buttonRadius: "rounded-lg",
        shadow: "shadow-sm hover:shadow-md",
        borderStyle: "border border-zinc-200",
        cardStyle: "bg-zinc-50 border border-zinc-100 rounded-xl overflow-hidden p-4",
      },
      navigation: {
        type: "sticky_header",
        details: "Sticky clean header with search bar, collection links, and dynamic bag/cart counter pill",
      },
      hero: {
        composition: "split",
        headline: "Engineered for longevity. Tailored for comfort.",
        subheadline: "Introducing the Autumn / Winter capsule collection crafted from regenerative Japanese wool.",
        ctaText: "Shop Collection",
        details: "Hero product showcase with quick-add size selector and lookbook photography",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "Studio product photography and contextual on-model lookbook shots",
        imageTreatment: "Clean off-white background with subtle product shadow",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Smooth image zoom on hover and instant cart drawer feedback",
        keyframes: ["fadeIn", "fadeInUp"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Two-column mobile product grid with sticky bottom quick-add bar",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-zinc-900",
        semanticElements: true,
      },
      signature: "Sticky cart drawer trigger with instant variant preview and fast checkout micro-flow",
    };
  }

  // 6. Editorial / Magazine / Journalism
  if (/editorial|magazine|journal|gazette|publication|blog|newsletter/.test(lower)) {
    return {
      purpose: "Thought-leadership publication and culture magazine",
      targetAudience: "Intellectuals, industry leaders, and readers seeking deep-dive investigative essays",
      category: "editorial_blog",
      visualDirection: "Refined editorial publication with warm paper background, rich serif typography, and multi-column article spreads",
      archetype: "editorial_magazine",
      brandPersonality: ["insightful", "literary", "provocative"],
      colorPalette: {
        theme: "light",
        bg: "#fdfbf7",
        fg: "#1c1917",
        muted: "#78716c",
        line: "#e7e5e4",
        accent: "#c2410c",
        accentForeground: "#ffffff",
        cardBg: "#ffffff",
        cardBorder: "#f5f5f4",
      },
      typography: {
        heading: {
          family: "Playfair Display",
          weights: ["600", "700", "800"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600&display=swap",
          usage: "Cover headlines, essay titles, pull quotes",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
          usage: "Article body copy, author bylines, reading time indicators",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-6xl",
        sectionPadding: "py-20 md:py-32",
        gap: "gap-8 md:gap-14",
        structure: "Broadsheet editorial spread (Lead Story, Dual Essay Column, Culture Briefs, Opinion, Newsletter Archive)",
      },
      componentStyling: {
        cardRadius: "rounded-none",
        buttonRadius: "rounded-none",
        shadow: "none",
        borderStyle: "border border-stone-200",
        cardStyle: "bg-white border border-stone-200 p-8",
      },
      navigation: {
        type: "sticky_header",
        details: "Classic editorial masthead with edition date, categories, and subscription callout",
      },
      hero: {
        composition: "split",
        headline: "The Architecture of Attention in the Algorithmic Age.",
        subheadline: "An investigation into how synthetic cognition is restructuring human memory and social institutions.",
        ctaText: "Read Cover Story",
        details: "Broadsheet cover story presentation with lead photograph and reading duration badge",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "Editorial photojournalism and conceptual cultural photography",
        imageTreatment: "Unfiltered natural light with serif captions",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Calm page entrance and subtle hover underline reveals",
        keyframes: ["fadeIn", "fadeInUp"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Single column reading stream with sticky reading progress indicator",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant (min 7:1 for text)",
        focusRings: "focus-visible:ring-2 focus-visible:ring-stone-900",
        semanticElements: true,
      },
      signature: "Broadsheet multi-column layout with editorial pull quotes and reading progress tracker",
    };
  }

  // 7. Technology / Deep Tech Infrastructure / Cyber
  if (/\b(deeptech|robotics|quantum|infrastructure|runtime|developer tool|cybersecurity|cloud compute)\b/.test(lower) || (/\bai\b/.test(lower) && !/analytics|dashboard|finance|fintech|b2b/.test(lower))) {
    return {
      purpose: "Next-generation deep tech infrastructure & runtime platform",
      targetAudience: "Engineers, systems architects, and technical leaders scaling modern compute systems",
      category: "developer_tools",
      visualDirection: "Futuristic dark tech aesthetic with cybernetic glows, monospace metadata badges, and interactive telemetry",
      archetype: "futuristic_technology",
      brandPersonality: ["powerful", "autonomous", "cutting-edge"],
      colorPalette: {
        theme: "dark",
        bg: "#030712",
        fg: "#f9fafb",
        muted: "#9ca3af",
        line: "#1f2937",
        accent: "#06b6d4",
        accentForeground: "#030712",
        cardBg: "#0f172a",
        cardBorder: "#1e293b",
      },
      typography: {
        heading: {
          family: "Space Grotesk",
          weights: ["600", "700"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
          usage: "Platform headlines, telemetry metrics, technical features",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
          usage: "Documentation, specifications, architecture descriptions",
        },
        mono: {
          family: "JetBrains Mono",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
          usage: "Code snippets, CLI commands, status badges",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      layout: {
        containerWidth: "max-w-7xl",
        sectionPadding: "py-24 md:py-36",
        gap: "gap-8 md:gap-14",
        structure: "Technical narrative (Hero Terminal, Architectural Pillars, Live Benchmarks, Integration CLI, CTA)",
      },
      componentStyling: {
        cardRadius: "rounded-xl",
        buttonRadius: "rounded-lg",
        shadow: "shadow-2xl shadow-cyan-950/20",
        borderStyle: "border border-cyan-500/20",
        cardStyle: "bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-8 hover:border-cyan-500/40 transition",
      },
      navigation: {
        type: "sticky_header",
        details: "Clean technical navbar with system status indicator (99.99% uptime) and CLI copy button",
      },
      hero: {
        composition: "split",
        headline: "Deterministic AI Runtime for Autonomous Agent Fleets.",
        subheadline: "Sub-millisecond inference routing, distributed vector synchronization, and verifiable cryptographical execution.",
        ctaText: "Deploy Cluster",
        details: "Split hero with interactive CLI terminal preview and real-time benchmark throughput counter",
      },
      mediaDirection: {
        type: "code_graphics",
        description: "Interactive command-line terminals, network topology visualizations, and benchmark charts",
        imageTreatment: "Glowing border ring with dark carbon finish",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Luminous cybernetic border pulses and terminal typing animations",
        keyframes: ["fadeIn", "float"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Responsive terminal view with horizontal code scrolling",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant",
        focusRings: "focus-visible:ring-2 focus-visible:ring-cyan-400",
        semanticElements: true,
      },
      signature: "Interactive CLI terminal hero with live latency simulator and luminous border shine",
    };
  }

  // 8. Professional Corporate / Legal / Advisory / Wealth
  if (/corporate|consulting|advisory|legal|law firm|wealth|finance|private equity|venture capital/.test(lower)) {
    return {
      purpose: "Executive corporate advisory and professional services website",
      targetAudience: "Enterprise leaders, board members, and institutional investors seeking strategic counsel",
      category: "saas_landing",
      visualDirection: "Dignified corporate presence with deep navy authority, crisp typographic structure, and executive metric credentials",
      archetype: "professional_corporate",
      brandPersonality: ["authoritative", "trustworthy", "strategic"],
      colorPalette: {
        theme: "light",
        bg: "#ffffff",
        fg: "#0f172a",
        muted: "#64748b",
        line: "#e2e8f0",
        accent: "#1e3a8a",
        accentForeground: "#ffffff",
        cardBg: "#f8fafc",
        cardBorder: "#e2e8f0",
      },
      typography: {
        heading: {
          family: "Plus Jakarta Sans",
          weights: ["600", "700", "800"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
          usage: "Strategic pillars, executive statements, metric counters",
        },
        body: {
          family: "Inter",
          weights: ["400", "500"],
          googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
          usage: "Advisory practice briefs, governance frameworks, bios",
        },
        fontImportUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
      },
      layout: {
        containerWidth: "max-w-7xl",
        sectionPadding: "py-20 md:py-32",
        gap: "gap-8 md:gap-14",
        structure: "Executive narrative (Hero Consultation, Strategic Practices, Institutional Impact, Leadership, Confidential Inquiry)",
      },
      componentStyling: {
        cardRadius: "rounded-lg",
        buttonRadius: "rounded-md",
        shadow: "shadow-sm hover:shadow",
        borderStyle: "border border-slate-200",
        cardStyle: "bg-slate-50 border border-slate-200 rounded-lg p-8",
      },
      navigation: {
        type: "sticky_header",
        details: "Dignified corporate navbar with practice dropdowns, investor portal, and consultation CTA",
      },
      hero: {
        composition: "split",
        headline: "Strategic clarity for complex institutional decisions.",
        subheadline: "Global management consultancy partnering with visionary leadership teams across enterprise transformation and capital allocation.",
        ctaText: "Schedule Consultation",
        details: "Executive hero with verified institutional metrics and confidential advisory booking",
      },
      mediaDirection: {
        type: "curated_photography",
        description: "Modern architectural headquarters and executive boardroom photography",
        imageTreatment: "Subtle cool corporate color grading",
        iconStyle: "Lucide React inline SVG icons",
      },
      motion: {
        strategy: "Restrained executive transitions and subtle card elevation",
        keyframes: ["fadeIn", "fadeInUp"],
        reducedMotion: true,
      },
      responsive: {
        breakpoints: "Mobile (<640px), Desktop (>640px)",
        mobileStrategy: "Clean stacked layout preserving executive hierarchy and touch targets",
      },
      accessibility: {
        contrastRatio: "WCAG 2.2 AA compliant (min 7:1 for text)",
        focusRings: "focus-visible:ring-2 focus-visible:ring-blue-900",
        semanticElements: true,
      },
      signature: "Institutional metric counter row with confidential advisory booking trigger",
    };
  }

  // 9. Default Modern SaaS / Tech Product
  return {
    purpose: "Modern high-converting web landing page",
    targetAudience: "Prospective customers, developers, and product teams",
    category: "saas_landing",
    visualDirection: wantsDark ? "Cinematic dark luxury aesthetic with luminous ambient accents" : "Clean modern SaaS interface with crisp typography and refined elevations",
    archetype: wantsDark ? "dark_luxury" : "clean_modern",
    brandPersonality: ["innovative", "polished", "reliable"],
    colorPalette: {
      theme: wantsDark ? "dark" : "light",
      bg: wantsDark ? "#09090b" : "#ffffff",
      fg: wantsDark ? "#fafafa" : "#09090b",
      muted: wantsDark ? "#a1a1aa" : "#71717a",
      line: wantsDark ? "#27272a" : "#e4e4e7",
      accent: wantsDark ? "#818cf8" : "#6366f1",
      accentForeground: "#ffffff",
      cardBg: wantsDark ? "#18181b" : "#ffffff",
      cardBorder: wantsDark ? "#27272a" : "#e4e4e7",
    },
    typography: {
      heading: {
        family: "Plus Jakarta Sans",
        weights: ["600", "700", "800"],
        googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500&display=swap",
        usage: "Hero headlines, section headers",
      },
      body: {
        family: "Inter",
        weights: ["400", "500"],
        googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
        usage: "Body paragraphs, navigation links, cards",
      },
      fontImportUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500&display=swap",
    },
    layout: {
      containerWidth: "max-w-7xl",
      sectionPadding: "py-20 md:py-32",
      gap: "gap-8 md:gap-12",
      structure: "Narrative product landing page tailored to the core value proposition",
    },
    componentStyling: {
      cardRadius: "rounded-2xl",
      buttonRadius: "rounded-full",
      shadow: "shadow-sm hover:shadow-md",
      borderStyle: wantsDark ? "border border-zinc-800" : "border border-zinc-200",
      cardStyle: wantsDark ? "bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8" : "bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm",
    },
    navigation: {
      type: "sticky_header",
      details: "Sticky translucent navbar with brand logo, nav links, and CTA",
    },
    hero: {
      composition: "centered",
      ctaText: "Get Started Free",
      details: "High-impact centered hero with announcement chip, bold H1, and dual action buttons",
    },
    mediaDirection: {
      type: "curated_photography",
      description: "High-resolution curated photography and visual cards",
      imageTreatment: "Rounded corners with subtle border ring",
      iconStyle: "Lucide React inline SVG icons",
    },
    motion: {
      strategy: "Smooth entrance fades and hover lift micro-interactions",
      keyframes: ["fadeInUp", "float"],
      reducedMotion: true,
    },
    responsive: {
      breakpoints: "Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)",
      mobileStrategy: "Responsive fluid grid and mobile menu",
    },
    accessibility: {
      contrastRatio: "WCAG 2.2 AA compliant",
      focusRings: "focus-visible:ring-2 focus-visible:ring-indigo-500",
      semanticElements: true,
    },
    signature: "Ambient lighting glow with crisp typographic hierarchy and pill badge micro-interactions",
  };
}

export function buildFilePlanSystem(designSpec) {
  const specContext = designSpec
    ? `
---

## ACTIVE DESIGN SPECIFICATION CONTRACT
You MUST build a file plan that directly implements this design specification:
- **Category:** ${designSpec.category}
- **Archetype:** ${designSpec.archetype}
- **Theme:** ${designSpec.colorPalette?.theme || "light"}
- **Palette Tokens:** Background ${designSpec.colorPalette?.bg}, Text ${designSpec.colorPalette?.fg}, Accent ${designSpec.colorPalette?.accent}, Card ${designSpec.colorPalette?.cardBg}
- **Typography:** Display "${designSpec.typography?.heading?.family}" + Body "${designSpec.typography?.body?.family}"
- **Font Import URL:** \`${designSpec.typography?.fontImportUrl || ""}\`
- **Layout Structure:** ${designSpec.layout?.structure}
- **Navigation Type:** ${designSpec.navigation?.type}
- **Hero Composition:** ${designSpec.hero?.composition}
- **Signature Visual Hook:** ${designSpec.signature}

---
`
    : "";

  return `${BASE_SYSTEM}
${specContext}
You are planning which files to create for a React project based on the Design Specification.
Respond with a JSON object listing every file needed, including their contract of imports and exports (so different files don't have mismatched component or default export signatures):
{
  "files": [
    { 
      "path": "/App.js", 
      "description": "Main app component assembling layout, navigation, hero, and sections",
      "exports": "default App",
      "imports": ["./styles.css", "./components/Header.js", "./components/Hero.js", "./components/Features.js", "./components/Footer.js"]
    },
    { 
      "path": "/styles.css", 
      "description": "Global CSS: Google Fonts import, root CSS variables for DesignSpec palette, keyframe animations",
      "exports": "none",
      "imports": []
    },
    { 
      "path": "/components/Header.js", 
      "description": "Sticky navigation header adhering to DesignSpec navigation",
      "exports": "default Header",
      "imports": []
    }
  ],
  "projectName": "My App",
  "projectDescription": "A short summary of this project"
}

Rules:
- ALWAYS include /App.js
- ALWAYS include /styles.css with the exact font imports and CSS root variables matching the DesignSpec
- Match the component plan to the DesignSpec category:
  * For "interactive_app" or "utility_game": Plan ONLY /App.js and /styles.css! Write all state, logic, and UI components inside /App.js.
  * For marketing landing pages and brand sites: Plan /App.js, /styles.css, and modular component files in /components/ (e.g. Header.js, Hero.js, Content sections, CTA.js, Footer.js).
- Define "exports" indicating what this file will export (Every JS component file must have EXACTLY ONE default export).
- Define "imports" listing relative file imports this component relies on from the plan.
- Do NOT write any code — only plan the file list.`;
}

export const FILE_PLAN_SYSTEM = buildFilePlanSystem(null);

export function buildFileCodeSystem(allFiles, alreadyGeneratedFiles, designSpec) {
    const fileList = allFiles
        .map((f) => {
            const impStr = f.imports && f.imports.length > 0 ? ` (Imports: ${f.imports.join(", ")})` : "";
            const expStr = f.exports ? ` (Exports: ${f.exports})` : "";
            return `  ${f.path}: ${f.description}${impStr}${expStr}`;
        })
        .join("\n");

    let contextStr = "";
    if (alreadyGeneratedFiles && Object.keys(alreadyGeneratedFiles).length > 0) {
        contextStr =
            "\n\nCRITICAL CONTEXT — Already Generated Files:\n" +
            "The following files have already been generated. You MUST align your exports, imports, CSS selectors, or props signatures EXACTLY with these files:\n";
        for (const [path, code] of Object.entries(alreadyGeneratedFiles)) {
            contextStr += `\nFile: ${path}\n\`\`\`javascript\n${code}\n\`\`\`\n`;
        }
    }

    let designSpecStr = "";
    if (designSpec) {
      designSpecStr = `
\n---
## MANDATORY DESIGN SPECIFICATION COMPLIANCE
Every component you write MUST conform to this exact design specification:
- **Archetype:** ${designSpec.archetype}
- **Theme:** ${designSpec.colorPalette?.theme || "light"}
- **Colors:** Background: ${designSpec.colorPalette?.bg}, Text: ${designSpec.colorPalette?.fg}, Muted: ${designSpec.colorPalette?.muted}, Line: ${designSpec.colorPalette?.line}, Accent: ${designSpec.colorPalette?.accent}, CardBg: ${designSpec.colorPalette?.cardBg}, CardBorder: ${designSpec.colorPalette?.cardBorder}
- **Heading Font:** "${designSpec.typography?.heading?.family}"
- **Body Font:** "${designSpec.typography?.body?.family}"
- **Font Import Link (for styles.css):** \`${designSpec.typography?.fontImportUrl || ""}\`
- **Card Styling:** \`${designSpec.componentStyling?.cardStyle}\`
- **Button Radius:** \`${designSpec.componentStyling?.buttonRadius}\`
- **Signature Hook:** "${designSpec.signature}"
- **Icons:** Use \`lucide-react\` inline SVG icons (e.g. \`import { ArrowRight, Check, Sparkles } from 'lucide-react'\`). Do NOT use external Font Awesome CDNs.
---
`;
    }

    return `${BASE_SYSTEM}

You are writing a SINGLE file for a React project.
The full project file structure is:
${fileList}${contextStr}${designSpecStr}

Write ONLY the code for the specific file the user requests.
Return a JSON object with exactly this shape:
{ "code": "full source code of the file" }

CRITICAL: Return ONLY the JSON object. Do NOT wrap it in markdown code fences. Do NOT add any explanation text before or after the JSON.

Rules:
- Do NOT include any other files
- The code must be complete, visually stunning, and production-ready
- Import other project files using their exact paths (e.g. import Header from './components/Header')
- The /styles.css file MUST include the DesignSpec font @import URL and declared keyframe animations
- Icons: Use lucide-react components (e.g. import { ... } from 'lucide-react')
- Apply the full design system defined in the design specification — consistent typography, generous spacing, and smooth hover micro-interactions`;
}
