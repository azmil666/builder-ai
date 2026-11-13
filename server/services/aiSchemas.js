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
  framework: z.enum(["vanilla", "react"]).optional(),
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

// --- Requirement Contract Schemas (Phase 2 Quality Engine V2) ---

export const RequirementIdentitySchema = z.object({
  name: z.string().default("Generated Project"),
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
  purpose: z.string().default("Web application"),
  targetAudience: z.string().default("General audience"),
  intendedUserExperience: z.string().default("Intuitive, responsive, modern digital experience"),
  mainConversionAction: z.string().default("Explore features and get started"),
});

export const RequirementSectionSchema = z.object({
  id: z.string().default("section"),
  name: z.string().default("Content Section"),
  order: z.number().default(1),
  purpose: z.string().default("Presents key content"),
  requiredContent: z.array(z.string()).default([]),
  callToAction: z.string().optional().default(""),
  supportingElements: z.array(z.string()).default([]),
  priority: z.enum(["mandatory", "optional", "inferred"]).default("mandatory"),
});

export const RequirementPageSchema = z.object({
  id: z.string().default("home"),
  name: z.string().default("Home"),
  path: z.string().default("/"),
  viewId: z.string().default("home"),
  purpose: z.string().default("Main application entry and primary landing"),
  isPrimary: z.boolean().default(true),
  order: z.number().default(1),
  sections: z.array(RequirementSectionSchema).default([]),
});

export const RequirementNavigationSchema = z.object({
  type: z.enum(["sticky_header", "floating_island", "minimal_bar", "sidebar", "none"]).default("sticky_header"),
  primaryItems: z.array(z.string()).default([]),
  secondaryItems: z.array(z.string()).default([]),
  callToAction: z.string().optional().default("Get Started"),
  importantRoutes: z.array(z.string()).default(["/"]),
  views: z.array(z.string()).default(["home"]),
});

export const RequirementDesignSchema = z.object({
  visualStyle: z.string().default("Clean, modern, and accessible"),
  colorPreferences: z.object({
    theme: z.enum(["light", "dark", "custom", "adaptive"]).default("light"),
    primaryAccent: z.string().optional().default(""),
    explicitPalette: z.array(z.string()).default([]),
    notes: z.string().default(""),
    origin: z.enum(["explicit", "inferred", "unspecified"]).default("inferred"),
  }).default(() => ({
    theme: "light",
    primaryAccent: "",
    explicitPalette: [],
    notes: "",
    origin: "inferred",
  })),
  typographyDirection: z.object({
    headingStyle: z.string().default("Modern sans-serif"),
    bodyStyle: z.string().default("Legible clean sans-serif"),
    preferredFonts: z.array(z.string()).default([]),
    origin: z.enum(["explicit", "inferred", "unspecified"]).default("unspecified"),
  }).default(() => ({
    headingStyle: "Modern sans-serif",
    bodyStyle: "Legible clean sans-serif",
    preferredFonts: [],
    origin: "unspecified",
  })),
  layoutPreferences: z.object({
    density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
    containerWidth: z.string().default("max-w-7xl"),
    gridStyle: z.string().default("Responsive multi-column grid"),
    origin: z.enum(["explicit", "inferred", "unspecified"]).default("inferred"),
  }).default(() => ({
    density: "comfortable",
    containerWidth: "max-w-7xl",
    gridStyle: "Responsive multi-column grid",
    origin: "inferred",
  })),
  componentStyling: z.object({
    cardRadius: z.string().default("rounded-2xl"),
    buttonRadius: z.string().default("rounded-full"),
    shadows: z.string().default("Subtle elevations with smooth hover transition"),
    origin: z.enum(["explicit", "inferred", "unspecified"]).default("inferred"),
  }).default(() => ({
    cardRadius: "rounded-2xl",
    buttonRadius: "rounded-full",
    shadows: "Subtle elevations with smooth hover transition",
    origin: "inferred",
  })),
  spacingAndHierarchy: z.string().default("Generous whitespace with clear visual priority"),
  imageAndIllustration: z.string().default("High-resolution, topic-relevant photography and vector icons"),
  animationAndMotion: z.string().default("Subtle entrance reveals and smooth hover micro-interactions"),
  explicitDesignRequirements: z.array(z.string()).default([]),
  inferredDesignDecisions: z.array(z.string()).default([]),
});

export const RequirementFunctionSchema = z.object({
  id: z.string().default("feature"),
  name: z.string().default("Interactive Feature"),
  description: z.string().default("Interactive UI element or functional state"),
  category: z.enum([
    "forms_validation",
    "navigation_routing",
    "interactive_controls",
    "search_filtering",
    "tabs_accordions",
    "authentication_ui",
    "ecommerce_cart",
    "data_display_state",
    "game_logic",
    "utility_calculation",
    "other",
  ]).default("interactive_controls"),
  expectedBehavior: z.string().default(""),
  priority: z.enum(["mandatory", "optional", "inferred"]).default("mandatory"),
  implementationTarget: z.string().optional().default(""),
});

export const RequirementResponsiveSchema = z.object({
  desktop: z.string().default("Full multi-column layout with expanded navigation"),
  tablet: z.string().default("Adaptive 2-column layout with condensed controls"),
  mobile: z.string().default("Single column stacked layout with touch-friendly targets and simplified navigation"),
  importantAdaptations: z.array(z.string()).default([]),
});

export const RequirementContentSchema = z.object({
  requiredCopy: z.array(z.string()).default([]),
  toneOfVoice: z.string().default("Professional, clear, engaging"),
  imageryRequirements: z.array(z.string()).default([]),
  iconRequirements: z.array(z.string()).default(["lucide-react inline icons"]),
  placeholderRestrictions: z.string().default("Avoid generic lorem ipsum; write contextual, realistic content"),
  userProvidedAssets: z.array(z.string()).default([]),
});

export const RequirementContractSchema = z.object({
  framework: z.enum(["vanilla", "react"]).optional(),
  identity: RequirementIdentitySchema.default(() => ({
    name: "Generated Project",
    category: "saas_landing",
    purpose: "Web application",
    targetAudience: "General audience",
    intendedUserExperience: "Intuitive, responsive, modern digital experience",
    mainConversionAction: "Explore features and get started",
  })),
  navigation: RequirementNavigationSchema.default(() => ({
    type: "sticky_header",
    primaryItems: [],
    secondaryItems: [],
    callToAction: "Get Started",
    importantRoutes: ["/"],
  })),
  pages: z.array(RequirementPageSchema).default([]),
  design: RequirementDesignSchema.default(() => ({
    visualStyle: "Clean, modern, and accessible",
    colorPreferences: {
      theme: "light",
      primaryAccent: "",
      explicitPalette: [],
      notes: "",
      origin: "inferred",
    },
    typographyDirection: {
      headingStyle: "Modern sans-serif",
      bodyStyle: "Legible clean sans-serif",
      preferredFonts: [],
      origin: "unspecified",
    },
    layoutPreferences: {
      density: "comfortable",
      containerWidth: "max-w-7xl",
      gridStyle: "Responsive multi-column grid",
      origin: "inferred",
    },
    componentStyling: {
      cardRadius: "rounded-2xl",
      buttonRadius: "rounded-full",
      shadows: "Subtle elevations with smooth hover transition",
      origin: "inferred",
    },
    spacingAndHierarchy: "Generous whitespace with clear visual priority",
    imageAndIllustration: "High-resolution, topic-relevant photography and vector icons",
    animationAndMotion: "Subtle entrance reveals and smooth hover micro-interactions",
    explicitDesignRequirements: [],
    inferredDesignDecisions: [],
  })),
  functionalRequirements: z.array(RequirementFunctionSchema).default([]),
  responsive: RequirementResponsiveSchema.default(() => ({
    desktop: "Full multi-column layout with expanded navigation",
    tablet: "Adaptive 2-column layout with condensed controls",
    mobile: "Single column stacked layout with touch-friendly targets and simplified navigation",
    importantAdaptations: [],
  })),
  content: RequirementContentSchema.default(() => ({
    requiredCopy: [],
    toneOfVoice: "Professional, clear, engaging",
    imageryRequirements: [],
    iconRequirements: ["lucide-react inline icons"],
    placeholderRestrictions: "Avoid generic lorem ipsum; write contextual, realistic content",
    userProvidedAssets: [],
  })),

  // Prioritization buckets for immediate machine decision-making
  mandatoryRequirements: z.array(z.string()).default([]),
  optionalEnhancements: z.array(z.string()).default([]),
  inferredRequirements: z.array(z.string()).default([]),
});

// --- Requirement Verification Schemas (Phase 3 Quality Engine V2) ---

export const RequirementVerificationStatusSchema = z.enum(["PASS", "PARTIAL", "FAIL", "UNVERIFIABLE"]);

export const RequirementVerificationItemSchema = z.object({
  requirementId: z.string(),
  requirementText: z.string(),
  requirementType: z.enum([
    "page_view",
    "section",
    "functional",
    "design",
    "responsive",
    "mandatory",
    "content",
    "navigation",
    "consistency",
    "other",
  ]),
  priority: z.enum(["mandatory", "optional", "inferred"]).default("mandatory"),
  status: RequirementVerificationStatusSchema,
  confidence: z.number().min(0).max(1).default(1),
  evidence: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  affectedFiles: z.array(z.string()).default([]),
  recommendedAction: z.string().default(""),
  source: z.enum(["deterministic_static", "ai_assisted", "infrastructure_fallback"]).default("deterministic_static"),
});

export const RequirementVerificationSummarySchema = z.object({
  totalRequirements: z.number().default(0),
  passed: z.number().default(0),
  partial: z.number().default(0),
  failed: z.number().default(0),
  unverifiable: z.number().default(0),
  mandatoryPassed: z.number().default(0),
  mandatoryFailed: z.number().default(0),
  mandatoryUnverifiable: z.number().default(0),
  overallStatus: z.enum(["VERIFIED", "PARTIAL", "FAILED", "UNVERIFIABLE"]).default("VERIFIED"),
  verificationWarnings: z.array(z.string()).default([]),
  requirements: z.array(RequirementVerificationItemSchema).default([]),
  evaluatedAt: z.string().optional(),
  diagnosticLimitations: z.string().optional(),
});

export const AiVerificationBatchSchema = z.object({
  evaluations: z.array(
    z.object({
      requirementId: z.string(),
      status: RequirementVerificationStatusSchema,
      confidence: z.number().min(0).max(1).default(0.8),
      evidence: z.array(z.string()).default([]),
      missingEvidence: z.array(z.string()).default([]),
      explanation: z.string().default(""),
      recommendedAction: z.string().default(""),
    })
  ),
});

// --- Targeted Self-Repair Schemas (Phase 4 Quality Engine V2) ---

export const FailureCategorySchema = z.enum([
  "REQUIREMENT_FAIL",
  "REQUIREMENT_PARTIAL",
  "REQUIREMENT_UNVERIFIABLE",
  "CODE_VALIDATION_ERROR",
  "RUNTIME_ERROR",
  "VISUAL_OVERFLOW",
  "FILE_PLAN_MISMATCH",
]);

export const RepairabilitySchema = z.enum([
  "REPAIRABLE",
  "UNREPAIRABLE_UNVERIFIABLE",
  "NON_ACTIONABLE",
  "COMPLEX_MANUAL",
]);

export const ClassifiedFailureSchema = z.object({
  id: z.string(),
  category: FailureCategorySchema,
  requirementId: z.string().nullable().optional(),
  requirementDescription: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  evidence: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  affectedFiles: z.array(z.string()).default([]),
  diagnosticExplanation: z.string(),
  repairabilityClassification: RepairabilitySchema,
});

export const RepairTaskSchema = z.object({
  taskId: z.string(),
  failureCategory: FailureCategorySchema,
  requirementId: z.string().nullable().optional(),
  failureIds: z.array(z.string()).default([]),
  targetFile: z.string().optional(),
  affectedFiles: z.array(z.string()),
  expectedBehavior: z.string(),
  specificMissingImplementation: z.string(),
  constraints: z.array(z.string()).default([]),
  verificationCriteria: z.array(z.string()).default([]),
});

export const RepairPlanSchema = z.object({
  planId: z.string(),
  tasks: z.array(RepairTaskSchema),
  prioritizedFiles: z.array(z.string()),
  createdAt: z.string(),
});

export const RepairedFileItemSchema = z.object({
  path: z.string(),
  code: z.string(),
  explanation: z.string().optional().default(""),
});

export const TargetedRepairBatchSchema = z.object({
  files: z.array(RepairedFileItemSchema),
  summary: z.string().default("Applied targeted repairs"),
});

export const SelfRepairReportSchema = z.object({
  repairTriggered: z.boolean(),
  initialStatus: z.string(),
  finalStatus: z.string(),
  attemptCount: z.number().default(0),
  maxAttempts: z.number().default(2),
  failures: z.array(ClassifiedFailureSchema).default([]),
  repairPlan: RepairPlanSchema.nullable().optional(),
  filesChanged: z.array(z.string()).default([]),
  accepted: z.boolean().default(false),
  rollbackPerformed: z.boolean().default(false),
  rollbackReason: z.string().nullable().optional(),
  beforeVerificationSummary: z.any().nullable().optional(),
  afterVerificationSummary: z.any().nullable().optional(),
  attempts: z.array(z.any()).default([]),
  completedAt: z.string().optional(),
});

export const GenerationResultSchema = z.object({
    files: z.record(z.string(),  z.string()),
    description: z.string().default('Generated project'),
    designSpec: DesignSpecSchema.optional(),
    requirementContract: RequirementContractSchema.optional(),
    requirementVerification: RequirementVerificationSummarySchema.optional(),
    selfRepair: SelfRepairReportSchema.optional(),
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

export const PlannedFileItemSchema = z.object({
    path: z.string(),
    description: z.string(),
    isEntry: z.boolean().default(false),
    mandatory: z.boolean().default(true),
    responsibilities: z.array(z.string()).default([]),
    expectedExports: z.array(z.string()).default([]),
    exports: z.string().optional().default(""), // backward compatibility
    localImports: z.array(z.string()).default([]),
    imports: z.array(z.string()).optional().default([]), // backward compatibility
    dependencies: z.array(z.string()).default([]), // external npm packages needed (e.g. ["lucide-react"])
    generationOrder: z.number().default(1),
});

export const ManifestSchema = z.object({
    entryPoint: z.string().default("/App.js"),
    totalFiles: z.number().default(0),
    requiredFeatures: z.array(z.string()).default([]),
    generationOrder: z.array(z.string()).default([]),
});

export const FilePlanSchema = z.object({
    files: z.array(PlannedFileItemSchema),
    projectName: z.string().default('Generated Project'),
    projectDescription: z.string().default('A React project'),
    manifest: ManifestSchema.optional(),
});

export const FileCodeSchema = z.object({
    code: z.string(),
});
