import { z } from "zod";

export const ColorPaletteSchema = z.object({
  theme: z.enum(["light", "dark", "custom"]).default("light"),
  bg: z.string().default("#ffffff"),
  fg: z.string().default("#09090b"),
  muted: z.string().default("#71717a"),
  line: z.string().default("#e4e4e7"),
  accent: z.string().default("#6366f1"),
  accentForeground: z.string().default("#ffffff"),
  cardBg: z.string().default("#ffffff"),
  cardBorder: z.string().default("#e4e4e7"),
});

export const TypographyItemSchema = z.object({
  family: z.string(),
  weights: z.array(z.string()).default(["400", "600", "700"]),
  googleFontsUrl: z.string().optional().default(""),
  usage: z.string().optional().default(""),
});

export const TypographyPairingSchema = z.object({
  heading: TypographyItemSchema,
  body: TypographyItemSchema,
  mono: TypographyItemSchema.optional(),
  fontImportUrl: z.string().default(""),
});

export const DesignSpecSchema = z.object({
  // Core Identity & Category
  purpose: z.string().default("Web application"),
  targetAudience: z.string().default("General audience"),
  category: z.enum([
    "interactive_app",
    "saas_landing",
    "agency_portfolio",
    "ecommerce",
    "editorial_blog",
    "restaurant_hospitality",
    "developer_tools",
    "personal_brand",
    "utility_game",
    "other",
  ]).default("saas_landing"),

  // Visual Direction & Archetype
  visualDirection: z.string().default("Clean, modern, and accessible"),
  archetype: z.enum([
    "clean_modern",
    "dark_luxury",
    "editorial_magazine",
    "swiss_international",
    "neo_brutalism",
    "bento_grid",
    "minimal_utility",
    "experimental_creative",
    "futuristic_technology",
    "organic_natural",
    "modern_ecommerce",
    "professional_corporate",
  ]).default("clean_modern"),
  brandPersonality: z.array(z.string()).default(["clean", "professional", "modern"]),

  // Color & Tokens
  colorPalette: ColorPaletteSchema.default(() => ({
    theme: "light",
    bg: "#ffffff",
    fg: "#09090b",
    muted: "#71717a",
    line: "#e4e4e7",
    accent: "#6366f1",
    accentForeground: "#ffffff",
    cardBg: "#ffffff",
    cardBorder: "#e4e4e7",
  })),

  // Typography
  typography: TypographyPairingSchema.default(() => ({
    heading: {
      family: "Inter",
      weights: ["600", "700", "800"],
      googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap",
      usage: "Headings, titles, badges",
    },
    body: {
      family: "Inter",
      weights: ["400", "500"],
      googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
      usage: "Body copy, navigation, buttons",
    },
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  })),

  // Layout & Spacing
  layout: z.object({
    containerWidth: z.string().default("max-w-7xl"),
    sectionPadding: z.string().default("py-20 md:py-28"),
    gap: z.string().default("gap-6 md:gap-8"),
    structure: z.string().default("Single page landing structure"),
  }).default(() => ({
    containerWidth: "max-w-7xl",
    sectionPadding: "py-20 md:py-28",
    gap: "gap-6 md:gap-8",
    structure: "Single page landing structure",
  })),

  // Component Styling
  componentStyling: z.object({
    cardRadius: z.string().default("rounded-2xl"),
    buttonRadius: z.string().default("rounded-full"),
    shadow: z.string().default("shadow-sm hover:shadow-md"),
    borderStyle: z.string().default("border border-zinc-200"),
    cardStyle: z.string().default("bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"),
  }).default(() => ({
    cardRadius: "rounded-2xl",
    buttonRadius: "rounded-full",
    shadow: "shadow-sm hover:shadow-md",
    borderStyle: "border border-zinc-200",
    cardStyle: "bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm",
  })),

  // Navigation & Hero
  navigation: z.object({
    type: z.enum(["sticky_header", "floating_island", "minimal_bar", "sidebar", "none"]).default("sticky_header"),
    details: z.string().default("Sticky header with logo, links, and primary CTA"),
  }).default(() => ({
    type: "sticky_header",
    details: "Sticky header with logo, links, and primary CTA",
  })),

  hero: z.object({
    composition: z.enum(["split", "centered", "ambient_video", "floating_card", "interactive_canvas", "minimal"]).default("centered"),
    headline: z.string().optional().default(""),
    subheadline: z.string().optional().default(""),
    ctaText: z.string().default("Get Started"),
    details: z.string().default("Centered high-impact hero with badge and dual CTAs"),
  }).default(() => ({
    composition: "centered",
    ctaText: "Get Started",
    details: "Centered high-impact hero with badge and dual CTAs",
  })),

  // Media, Assets & Icons
  mediaDirection: z.object({
    type: z.enum(["curated_photography", "cinematic_video", "transparent_cutout", "code_graphics", "svg_illustrations", "none"]).default("curated_photography"),
    description: z.string().default("High-resolution, topic-relevant visuals"),
    imageTreatment: z.string().default("Rounded corners with subtle border"),
    iconStyle: z.string().default("Lucide React inline SVG icons"),
  }).default(() => ({
    type: "curated_photography",
    description: "High-resolution, topic-relevant visuals",
    imageTreatment: "Rounded corners with subtle border",
    iconStyle: "Lucide React inline SVG icons",
  })),

  // Motion & Responsiveness
  motion: z.object({
    strategy: z.string().default("Subtle entrance reveals and smooth hover micro-interactions"),
    keyframes: z.array(z.string()).default(["fadeIn", "fadeInUp"]),
    reducedMotion: z.boolean().default(true),
  }).default(() => ({
    strategy: "Subtle entrance reveals and smooth hover micro-interactions",
    keyframes: ["fadeIn", "fadeInUp"],
    reducedMotion: true,
  })),

  responsive: z.object({
    breakpoints: z.string().default("Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)"),
    mobileStrategy: z.string().default("Single column stack, simplified navigation"),
  }).default(() => ({
    breakpoints: "Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)",
    mobileStrategy: "Single column stack, simplified navigation",
  })),

  accessibility: z.object({
    contrastRatio: z.string().default("WCAG 2.2 AA compliant (min 4.5:1 for text)"),
    focusRings: z.string().default("focus-visible:ring-2 focus-visible:ring-offset-2"),
    semanticElements: z.boolean().default(true),
  }).default(() => ({
    contrastRatio: "WCAG 2.2 AA compliant (min 4.5:1 for text)",
    focusRings: "focus-visible:ring-2 focus-visible:ring-offset-2",
    semanticElements: true,
  })),

  // The Signature Visual Hook
  signature: z.string().default("Polished micro-interactions and typographic hierarchy"),
});

export const GenerationResultSchema = z.object({
    files: z.record(z.string(),  z.string()),
    description: z.string().default('Generated project'),
    designSpec: DesignSpecSchema.optional(),
});

export const FileOpSchema = z.object({
    op: z.enum(["create", "update", "delete"]),
    path: z.string(),
    content: z.string().nullable().optional(),
    search: z.string().nullable().optional(),
    replace: z.string().nullable().optional(),
});

export const RevisionResultSchema = z.object({
    operations: z.array(FileOpSchema),
    description: z.string().default('Applied revisions')
});

export const FilePlanSchema = z.object({
    files: z.array(
        z.object({
            path: z.string(),
            description: z.string(),
            exports: z.string().optional().default(""),
            imports: z.array(z.string()).optional().default([]),
        })
    ),
    projectName: z.string().default('Generated Project'),
    projectDescription: z.string().default('A React project')
});

export const FileCodeSchema = z.object({
    code: z.string(),
});
