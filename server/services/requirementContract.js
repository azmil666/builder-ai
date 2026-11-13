import { RequirementContractSchema } from "./aiSchemas.js";
import { generateStructuredObject } from "./ai.js";
import { REQUIREMENT_CONTRACT_SYSTEM } from "./prompts.js";

/**
 * Creates an intelligent, comprehensive fallback Requirement Contract directly
 * from user prompt heuristics if structured AI generation fails or is bypassed.
 */
export function createDefaultRequirementContract(prompt = "", frameworkOrOptions = null) {
  let framework = "react";
  if (typeof frameworkOrOptions === "string" && (frameworkOrOptions === "vanilla" || frameworkOrOptions === "react")) {
    framework = frameworkOrOptions;
  } else if (frameworkOrOptions && typeof frameworkOrOptions === "object" && (frameworkOrOptions.framework === "vanilla" || frameworkOrOptions.framework === "react")) {
    framework = frameworkOrOptions.framework;
  } else if (/\b(vanilla|html5?|pure js|no react)\b/i.test(prompt)) {
    framework = "vanilla";
  }

  const isVanilla = framework === "vanilla";
  const defaultTarget = (reactPath) => (isVanilla ? "/script.js" : reactPath);

  const p = prompt.toLowerCase();

  // Extract quoted copy from prompt (e.g. slogans, quotes, explicit phrases)
  const quotedMatches = [];
  const quoteRegex = /"([^"]+)"|'([^']+)'/g;
  let qMatch;
  while ((qMatch = quoteRegex.exec(prompt)) !== null) {
    const text = (qMatch[1] || qMatch[2] || "").trim();
    if (text.length >= 2 && text.length <= 120) {
      quotedMatches.push(text);
    }
  }

  // Detect explicit brand/site name from prompt (e.g., "for Lumen Candle Studio", "named Solstice", "called Velox")
  let detectedBrandName = null;
  const brandMatch = prompt.match(/\b(?:for|named|called|brand[:\s]+(?:named|called)?)\s+["']?([A-Z][A-Za-z0-9'&]+(?:\s+[A-Z][A-Za-z0-9'&]+)*)["']?/);
  if (brandMatch && brandMatch[1]) {
    const candidate = brandMatch[1].trim();
    if (candidate.length >= 2 && candidate.length <= 40 && !/^(The|A|An|Modern|Clean|Dark|Light|Website|App|Page|Portfolio|Store)$/.test(candidate)) {
      detectedBrandName = candidate;
    }
  }

  // Category detection
  const isWebsite = /\b(saas|landing|website|platform|store|ecommerce|e-commerce|portfolio|agency)\b/i.test(p);
  const isAppOrGame = !isWebsite && /\b(game|calculator|todo|tictactoe|tic tac toe|stopwatch|counter|quiz|weather|unit converter|chess|tracker|timer)\b/i.test(p);
  const isEcommerce = /\b(ecommerce|e-commerce|store|shop|sneaker|product|cart|checkout|clothing|apparel|shoes|catalog|candle|candles|jewelry|perfume|boutique|merchandise)\b/i.test(p);
  const isRestaurant = /\b(restaurant|cafe|coffee|bistro|dining|culinary|food|bakery|bar|kitchen|menu)\b/i.test(p);
  const isPortfolio = /\b(portfolio|agency|showcase|works?|projects?|photographer|designer|developer|freelancer)\b/i.test(p);

  let category = "saas_landing";
  let purpose = "Modern web application with responsive presentation";
  if (isAppOrGame) {
    category = "interactive_app";
    purpose = "Interactive web utility or game with responsive stateful UI";
  } else if (isEcommerce) {
    category = "ecommerce";
    purpose = "Modern boutique e-commerce storefront for product showcase and purchasing";
  } else if (isRestaurant) {
    category = "restaurant_hospitality";
    purpose = "Culinary destination website featuring menu showcase and table reservations";
  } else if (isPortfolio) {
    category = "agency_portfolio";
    purpose = "Creative portfolio and project showcase with client inquiry contact";
  }

  // Theme detection
  const wantsDark = /\b(dark|night|nocturnal|black|void|cyber|neon|matrix)\b/i.test(p);
  const wantsLight = /\b(light|clean|white|bright|day|minimal)\b/i.test(p);
  const explicitTheme = wantsDark ? "dark" : wantsLight ? "light" : null;
  const theme = explicitTheme || (isAppOrGame || isEcommerce ? "dark" : "light");
  const themeOrigin = explicitTheme ? "explicit" : "inferred";

  // Mandatory requirements extraction
  const mandatory = [];
  const optional = [];
  const inferred = [];

  if (explicitTheme) {
    mandatory.push(`${explicitTheme.toUpperCase()} visual theme`);
  } else {
    inferred.push(`${theme.toUpperCase()} visual theme inferred from category conventions`);
  }

  // Pages & Sections construction
  const pages = [];
  const functional = [];

  // Ecommerce specific intent flags
  const wantsCart = /\b(cart|bag|checkout|basket|purchase|buy)\b/i.test(p);
  const wantsFilters = /\b(filter|filters|filtering|search|sort|categories)\b/i.test(p);

  if (isAppOrGame) {
    mandatory.push("Direct interactive application interface");
    mandatory.push("Responsive state management and controls");
    pages.push({
      id: "app",
      viewId: "app",
      name: "Application Canvas",
      path: "/",
      purpose: "Single-view interactive application canvas",
      isPrimary: true,
      order: 1,
      sections: [
        {
          id: "app_header",
          name: "Application Controls & Header",
          order: 1,
          purpose: "Brand/title, active score/status, reset button",
          requiredContent: ["Application title", "Controls", "Status indicators"],
          callToAction: "Reset / New Game",
          supportingElements: ["Scoreboard", "Mode toggle"],
          priority: "mandatory",
        },
        {
          id: "app_main",
          name: "Interactive Workspace Canvas",
          order: 2,
          purpose: "Core interactive gameplay or utility workspace",
          requiredContent: ["Interactive grid / controls", "State display"],
          callToAction: "",
          supportingElements: ["Visual feedback", "Sound/visual state badge"],
          priority: "mandatory",
        },
      ],
    });
    functional.push({
      id: "app_state",
      name: "Core Application State",
      description: "Immediate state changes and computation on user interaction",
      category: "game_logic",
      expectedBehavior: "React state updates instantly upon interaction with clear visual transitions",
      priority: "mandatory",
      implementationTarget: defaultTarget("/App.js"),
    });
  } else if (isEcommerce) {
    mandatory.push("Product catalog listing and product cards");
    if (wantsCart) {
      mandatory.push("Interactive shopping cart drawer or bag state");
    } else {
      optional.push("Shopping cart drawer or bag checkout flow");
    }

    if (wantsFilters) {
      mandatory.push("Product filtering and search mechanism");
    } else {
      optional.push("Product filtering by category or tags");
    }

    const ecommerceSections = [
      {
        id: "hero",
        name: "Hero Spotlight",
        order: 1,
        purpose: "Impactful brand statement with curated visual showcase",
        requiredContent: ["Brand headline", "Season collection tagline"],
        callToAction: "Shop Collection",
        supportingElements: ["High-impact visual", "Badge"],
        priority: "mandatory",
      },
      {
        id: "catalog",
        name: "Product Collection Grid",
        order: 2,
        purpose: "Dynamic product display with filter controls",
        requiredContent: ["Product cards", "Prices", "Variants"],
        callToAction: wantsCart ? "Add to Bag" : "View Details",
        supportingElements: ["Category filter pills", "Sort toggle"],
        priority: "mandatory",
      },
    ];

    if (wantsCart) {
      ecommerceSections.push({
        id: "cart_drawer",
        name: "Shopping Bag Drawer",
        order: 3,
        purpose: "Interactive slide-over cart with line items and subtotal",
        requiredContent: ["Cart items", "Quantity controls", "Total calculation"],
        callToAction: "Checkout",
        supportingElements: ["Item removal", "Free shipping indicator"],
        priority: "mandatory",
      });
    }

    pages.push({
      id: "home",
      viewId: "home",
      name: "Storefront Home",
      path: "/",
      purpose: "Main storefront with hero spotlight and featured collection",
      isPrimary: true,
      order: 1,
      sections: ecommerceSections,
    });

    if (wantsCart) {
      functional.push({
        id: "cart_management",
        name: "Shopping Cart State",
        description: "Add, remove, and adjust quantity of products with reactive price totals",
        category: "ecommerce_cart",
        expectedBehavior: "Adding items opens or updates bag; totals update reactively",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/CartDrawer.js"),
      });
    }

    if (wantsFilters) {
      functional.push({
        id: "product_filters",
        name: "Catalog Filtering",
        description: "Filter products by category, size, or tags",
        category: "search_filtering",
        expectedBehavior: "Clicking filter pills immediately updates rendered product items",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/ProductGrid.js"),
      });
    }
  } else if (isRestaurant) {
    mandatory.push("Atmospheric hero presentation");
    mandatory.push("Curated culinary menu with categories");
    mandatory.push("Table reservation form or booking interaction");

    pages.push({
      id: "home",
      viewId: "home",
      name: "Restaurant Home",
      path: "/",
      purpose: "Atmospheric culinary experience, menu presentation, and table booking",
      isPrimary: true,
      order: 1,
      sections: [
        {
          id: "hero",
          name: "Atmospheric Culinary Hero",
          order: 1,
          purpose: "Sensory introduction to dining philosophy and cuisine",
          requiredContent: ["Restaurant headline", "Culinary philosophy"],
          callToAction: "Reserve a Table",
          supportingElements: ["Warm ambient imagery", "Hours badge"],
          priority: "mandatory",
        },
        {
          id: "menu",
          name: "Curated Menu Showcase",
          order: 2,
          purpose: "Categorized seasonal dishes with descriptions and pricing",
          requiredContent: ["Dish titles", "Ingredients", "Prices"],
          callToAction: "",
          supportingElements: ["Category tabs (Starters, Mains, Desserts, Wines)"],
          priority: "mandatory",
        },
        {
          id: "reservation",
          name: "Table Reservation Section",
          order: 3,
          purpose: "Interactive guest booking form with date, time, and party size",
          requiredContent: ["Date picker", "Time slots", "Guest count", "Contact input"],
          callToAction: "Confirm Reservation",
          supportingElements: ["Location details", "Operating hours"],
          priority: "mandatory",
        },
      ],
    });

    functional.push(
      {
        id: "reservation_form",
        name: "Interactive Reservation Form",
        description: "Select date, time, guests, and submit with confirmation feedback",
        category: "forms_validation",
        expectedBehavior: "Validates required fields and provides immediate confirmation message",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/Reservation.js"),
      },
      {
        id: "menu_filter",
        name: "Menu Category Filtering",
        description: "Filter dishes by course or dietary preference",
        category: "tabs_accordions",
        expectedBehavior: "Switching tabs displays corresponding course dishes smoothly",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/Menu.js"),
      }
    );
  } else {
    // SaaS, Portfolio, or General Landing
    mandatory.push("Impactful hero with value proposition and primary CTA");
    mandatory.push("Structured features presentation");
    mandatory.push("Footer navigation with social and legal links");

    pages.push({
      id: "home",
      viewId: "home",
      name: isPortfolio ? "Portfolio Showcase" : "Landing Page",
      path: "/",
      purpose: isPortfolio ? "Selected projects showcase and client inquiry" : "Comprehensive presentation of product benefits and conversion",
      isPrimary: true,
      order: 1,
      sections: [
        {
          id: "hero",
          name: "Hero Section",
          order: 1,
          purpose: "Immediate value proposition and trial conversion",
          requiredContent: ["Clear headline", "Supportive subheadline"],
          callToAction: isPortfolio ? "View Works" : "Get Started Free",
          supportingElements: ["Feature badge", "Proof metrics"],
          priority: "mandatory",
        },
        {
          id: "features",
          name: isPortfolio ? "Selected Works & Projects" : "Features & Capabilities",
          order: 2,
          purpose: isPortfolio ? "Curated project case studies with imagery and client details" : "Detailed overview of core workflow benefits",
          requiredContent: ["Feature cards", "Illustrative icons", "Short explanations"],
          callToAction: "Learn More",
          supportingElements: ["Grid layout", "Hover micro-interactions"],
          priority: "mandatory",
        },
        {
          id: "cta",
          name: "Closing Call to Action",
          order: 3,
          purpose: "Final conversion push before footer",
          requiredContent: ["Action prompt", "Guarantee or trial notice"],
          callToAction: isPortfolio ? "Let's Collaborate" : "Start Your Project",
          supportingElements: ["Dual CTAs"],
          priority: "mandatory",
        },
      ],
    });

    functional.push({
      id: "interactive_showcase",
      name: "Interactive Feature Toggle / Tabs",
      description: "Interactive tab or accordion demonstrating product capabilities",
      category: "tabs_accordions",
      expectedBehavior: "Clicking items smoothly switches the active demonstration view",
      priority: "mandatory",
      implementationTarget: defaultTarget("/components/Features.js"),
    });
  }

  // Prompt-driven additions (contact form, FAQ, reviews)
  const hasContact = /\b(contact\s*form|contact\s*us|get\s*in\s*touch|inquiry)\b/i.test(p);
  const hasFaq = /\b(faq|frequently\s*asked|accordions?)\b/i.test(p);
  const hasReviews = /\b(reviews?|testimonials?|social\s*proof)\b/i.test(p);

  const primaryPage = pages[0];
  if (primaryPage) {
    if (hasContact && !primaryPage.sections.some((s) => /contact/i.test(s.name))) {
      primaryPage.sections.push({
        id: "contact_section",
        name: "Contact Section",
        order: primaryPage.sections.length + 1,
        purpose: "User inquiry and message submission form",
        requiredContent: ["Name", "Email", "Message input", "Submit button"],
        callToAction: "Send Message",
        supportingElements: ["Input validation", "Success message"],
        priority: "mandatory",
      });
      functional.push({
        id: "contact_form_submission",
        name: "Contact Form Validation",
        description: "Validates inputs and handles submission with feedback toast",
        category: "forms_validation",
        expectedBehavior: "Validates required inputs and displays feedback toast on submit",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/Contact.js"),
      });
      mandatory.push("Contact inquiry form");
    }

    if (hasFaq && !primaryPage.sections.some((s) => /faq/i.test(s.name) || /faq/i.test(s.id))) {
      primaryPage.sections.push({
        id: "faq_section",
        name: "Frequently Asked Questions (FAQ)",
        order: primaryPage.sections.length + 1,
        purpose: "Accordion addressing common customer questions",
        requiredContent: ["Questions", "Answers"],
        callToAction: "",
        supportingElements: ["Expandable accordion items"],
        priority: "mandatory",
      });
      functional.push({
        id: "faq_accordion",
        name: "Interactive FAQ Accordion",
        description: "Expand and collapse question items smoothly",
        category: "tabs_accordions",
        expectedBehavior: "Clicking a question toggles its answer visibility",
        priority: "mandatory",
        implementationTarget: defaultTarget("/components/Faq.js"),
      });
      mandatory.push("FAQ Accordion section");
    }

    if (hasReviews && !primaryPage.sections.some((s) => /reviews|testimonials/i.test(s.name))) {
      primaryPage.sections.push({
        id: "testimonials_section",
        name: "Reviews & Testimonials",
        order: primaryPage.sections.length + 1,
        purpose: "Social proof showcasing customer quotes and ratings",
        requiredContent: ["User quotes", "Author names", "Rating stars"],
        callToAction: "",
        supportingElements: ["Rating stars", "Avatar images"],
        priority: "mandatory",
      });
      mandatory.push("Customer reviews and testimonials section");
    }
  }

  optional.push("Newsletter subscription with feedback toast");
  optional.push("Dark/Light mode switch toggle");
  inferred.push("Responsive hamburger drawer navigation on mobile viewports (<768px)");
  inferred.push("Smooth hover transitions and focus rings for accessibility");

  const defaultName = isEcommerce
    ? (/\b(sneaker|shoe)\b/i.test(p) ? "Sneaker Studio" : "Boutique Store")
    : isRestaurant
    ? "Savor Table"
    : isPortfolio
    ? "Creative Portfolio"
    : isAppOrGame
    ? "Interactive App"
    : "Builder Landing";
  const finalName = detectedBrandName || defaultName;

  const userProvidedAssets = [];
  if (detectedBrandName) {
    userProvidedAssets.push(`Brand Name: ${detectedBrandName}`);
  }

  const raw = {
    identity: {
      name: finalName,
      category,
      purpose,
      targetAudience: isEcommerce
        ? "Shoppers seeking curated, premium products and modern apparel"
        : isRestaurant
        ? "Guests seeking refined seasonal dining and convenient table bookings"
        : isPortfolio
        ? "Clients seeking bespoke creative direction and design solutions"
        : "Users seeking a streamlined, engaging modern digital experience",
      intendedUserExperience: "Fast, accessible, beautifully formatted responsive interface",
      mainConversionAction: isEcommerce
        ? (wantsCart ? "Add items to bag and proceed to checkout" : "Explore curated collection")
        : isRestaurant
        ? "Book a table reservation"
        : "Explore features and take action",
    },
    navigation: {
      type: isRestaurant ? "floating_island" : "sticky_header",
      primaryItems: isEcommerce
        ? ["Collections", "New Arrivals", "Best Sellers", "About"]
        : isRestaurant
        ? ["Menu", "Our Story", "Hours", "Reservations"]
        : isPortfolio
        ? ["Works", "About", "Services", "Contact"]
        : ["Features", "Product", "Pricing", "FAQ"],
      secondaryItems: isEcommerce ? (wantsCart ? ["Search", "Cart"] : ["Search"]) : ["Sign In"],
      callToAction: isEcommerce ? (wantsCart ? "Cart" : "Shop Collection") : isRestaurant ? "Reserve Table" : "Get Started",
      importantRoutes: ["/"],
      views: [isAppOrGame ? "app" : "home"],
    },
    pages,
    design: {
      visualStyle: wantsDark ? "Modern high-contrast dark aesthetic" : "Clean modern minimalist design",
      colorPreferences: {
        theme,
        primaryAccent: isEcommerce ? "#f97316" : isRestaurant ? "#d97706" : "#6366f1",
        explicitPalette: [],
        notes: `Selected ${theme} theme based on ${themeOrigin} request`,
        origin: themeOrigin,
      },
      typographyDirection: {
        headingStyle: isRestaurant ? "Refined display serif (Fraunces or Playfair Display)" : "Clean geometric sans (Inter or Plus Jakarta Sans)",
        bodyStyle: "Legible clean sans-serif (Inter, 400/500)",
        preferredFonts: isRestaurant ? ["Fraunces", "Plus Jakarta Sans"] : ["Inter", "Plus Jakarta Sans"],
        origin: "inferred",
      },
      layoutPreferences: {
        density: "comfortable",
        containerWidth: "max-w-7xl",
        gridStyle: "Responsive multi-column grid with generous whitespace",
        origin: "inferred",
      },
      componentStyling: {
        cardRadius: "rounded-2xl",
        buttonRadius: "rounded-full",
        shadows: "Subtle elevations with smooth hover transition",
        origin: "inferred",
      },
      spacingAndHierarchy: "Generous vertical rhythm (py-16 md:py-24) with crisp headline hierarchy",
      imageAndIllustration: "Diverse high-resolution Unsplash photography matching exact subject matter",
      animationAndMotion: "Subtle entrance reveals and smooth hover micro-interactions with reduced motion support",
      explicitDesignRequirements: explicitTheme ? [`${explicitTheme.toUpperCase()} color mode`] : [],
      inferredDesignDecisions: [`${theme.toUpperCase()} theme inferred from website domain`],
    },
    functionalRequirements: functional,
    responsive: {
      desktop: "Full multi-column layout with expanded navigation and rich interactive states",
      tablet: "Adaptive 2-column grid layout with condensed controls",
      mobile: "Single column stacked layout with touch-friendly buttons and collapsible navigation",
      importantAdaptations: [
        "Horizontal scroll prevention via overflow-hidden on outer containers",
        "Touch-friendly tap targets (min 44px) for all action buttons",
      ],
    },
    content: {
      requiredCopy: [...quotedMatches],
      toneOfVoice: isRestaurant ? "Atmospheric, welcoming, artisanal" : isPortfolio ? "Refined, visionary, articulate" : "Direct, confident, inspiring",
      imageryRequirements: isEcommerce ? ["Curated product photography, editorial showcase"] : isRestaurant ? ["Culinary dishes, dining room interior"] : ["Digital tools, modern interface"],
      iconRequirements: framework === "react" ? ["lucide-react inline icons"] : ["Inline SVG icons or Lucide SVG icons"],
      placeholderRestrictions: "Use realistic domain-specific copy and pricing; avoid generic lorem ipsum",
      userProvidedAssets,
    },
    mandatoryRequirements: mandatory,
    optionalEnhancements: optional,
    inferredRequirements: inferred,
    framework,
  };

  return RequirementContractSchema.parse(raw);
}

/**
 * Generates a machine-readable Requirement Contract using structured AI generation.
 * Falls back to createDefaultRequirementContract if AI generation fails or is malformed.
 */
export async function generateRequirementContract(prompt, options = {}) {
  const resolvedOptions = typeof options === "string" ? { framework: options } : (options || {});
  const maxRetries = resolvedOptions.maxRetries ?? 2;
  const targetFramework = resolvedOptions.framework || (/\b(react|jsx|tsx|component-based|single[- ]page app|spa)\b/i.test(prompt) ? "react" : "vanilla");

  try {
    const { object: contract } = await generateStructuredObject({
      schema: RequirementContractSchema,
      system: REQUIREMENT_CONTRACT_SYSTEM,
      prompt: `Analyze the user's website request and synthesize a complete, production-grade Requirement Contract for: "${prompt}" (Target Framework: ${targetFramework})`,
      maxRetries,
    });

    // Validate using Zod schema to ensure full structural compliance
    const validated = RequirementContractSchema.parse({
      ...contract,
      framework: contract.framework || targetFramework,
    });
    console.log(`[RequirementContract] Synthesized contract: category="${validated.identity.category}", framework="${validated.framework}", mandatory=${validated.mandatoryRequirements.length}, functional=${validated.functionalRequirements.length}`);
    return validated;
  } catch (err) {
    console.warn(`[RequirementContract] Structured AI synthesis failed (${err.message}). Using intelligent default contract.`);
    return createDefaultRequirementContract(prompt, targetFramework);
  }
}

/**
 * Formats the Requirement Contract into a concise, focused Markdown context block
 * specifically for DesignSpec generation.
 */
export function formatContractForDesignSpec(contract) {
  if (!contract) return "";

  const lines = [
    "## STRUCTURED REQUIREMENT CONTRACT GUIDANCE",
    `- **Website Category:** ${contract.identity?.category || "saas_landing"}`,
    `- **Purpose:** ${contract.identity?.purpose || "Web application"}`,
    `- **Target Audience:** ${contract.identity?.targetAudience || "General audience"}`,
    `- **Intended Experience:** ${contract.identity?.intendedUserExperience || "Intuitive and modern"}`,
    `- **Main Conversion:** ${contract.identity?.mainConversionAction || "Get Started"}`,
    "",
    "### Design & Aesthetic Preferences:",
    `- **Requested Theme:** ${contract.design?.colorPreferences?.theme || "light"} (Origin: ${contract.design?.colorPreferences?.origin || "inferred"})`,
    `- **Visual Direction:** ${contract.design?.visualStyle || "Clean and modern"}`,
    `- **Heading Direction:** ${contract.design?.typographyDirection?.headingStyle || "Modern sans"}`,
    `- **Explicit Requirements:** ${contract.design?.explicitDesignRequirements?.join("; ") || "None specified (use brand-aligned inferences)"}`,
    "",
    "### Mandatory User Requirements (MUST NOT BE OMITTED):",
  ];

  if (contract.mandatoryRequirements && contract.mandatoryRequirements.length > 0) {
    for (const req of contract.mandatoryRequirements) {
      lines.push(`- ${req}`);
    }
  } else {
    lines.push("- Deliver a complete, responsive, domain-specific website experience");
  }

  return lines.join("\n");
}

/**
 * Formats the Requirement Contract into a comprehensive blueprint
 * specifically for FilePlan generation.
 */
export function formatContractForFilePlan(contract) {
  if (!contract) return "";

  const lines = [
    "## REQUIREMENT CONTRACT FILE-PLANNING DIRECTIVE",
    `Every mandatory page, section, and functional requirement must be mapped to an implementation destination.`,
    "",
    `### Required Pages & Sections:`,
  ];

  if (contract.pages && contract.pages.length > 0) {
    for (const page of contract.pages) {
      lines.push(`- **Page: ${page.name}** (Route: \`${page.path}\`):`);
      if (page.sections && page.sections.length > 0) {
        for (const sec of page.sections) {
          lines.push(`  * Section "${sec.name}" (${sec.priority}): ${sec.purpose}`);
        }
      }
    }
  }

  lines.push("", "### Mandatory Functional Requirements:");
  if (contract.functionalRequirements && contract.functionalRequirements.length > 0) {
    for (const fn of contract.functionalRequirements) {
      lines.push(`- **${fn.name}** (${fn.category}): ${fn.description}. Expected: ${fn.expectedBehavior}`);
    }
  }

  lines.push("", "### Explicit Mandatory Requirements:");
  if (contract.mandatoryRequirements && contract.mandatoryRequirements.length > 0) {
    for (const req of contract.mandatoryRequirements) {
      lines.push(`- ${req}`);
    }
  }

  return lines.join("\n");
}

/**
 * Extracts ONLY the relevant contract slice for an individual file being generated,
 * avoiding unnecessary context bloating.
 */
export function formatContractForFileCode(contract, filePath) {
  if (!contract || !filePath) return "";

  const lines = [];

  if (filePath === "/App.js" || filePath === "/App.jsx") {
    lines.push(`### File Responsibility: Main Application Entry (${filePath})`);
    lines.push("- Must assemble all primary page sections and layout structure.");
    lines.push(`- Theme: ${contract.design?.colorPreferences?.theme || "light"} mode.`);
    if (contract.navigation) {
      lines.push(`- Navigation: Type="${contract.navigation.type}", Primary Items: ${contract.navigation.primaryItems?.join(", ")}`);
    }
    // List mandatory functional requirements that often live at App level (cart state, routing, active tabs)
    const appLevelFns = (contract.functionalRequirements || []).filter(
      (f) => !f.implementationTarget || f.implementationTarget === "/App.js" || f.implementationTarget === "/App.jsx" || f.category === "ecommerce_cart" || f.category === "game_logic"
    );
    if (appLevelFns.length > 0) {
      lines.push(`- Core Functional States to manage in ${filePath}:`);
      for (const fn of appLevelFns) {
        lines.push(`  * ${fn.name}: ${fn.expectedBehavior}`);
      }
    }
  } else if (filePath === "/index.html") {
    lines.push("### File Responsibility: Main Semantic HTML5 Entry (/index.html)");
    lines.push("- Must assemble all primary page sections and semantic HTML5 structure.");
    lines.push(`- Theme: ${contract.design?.colorPreferences?.theme || "light"} mode.`);
    if (contract.navigation) {
      lines.push(`- Navigation: Type="${contract.navigation.type}", Primary Items: ${contract.navigation.primaryItems?.join(", ")}`);
    }
  } else if (filePath === "/script.js") {
    lines.push("### File Responsibility: Main Vanilla JavaScript (/script.js)");
    lines.push("- Interactive DOM logic, event listeners, and dynamic UI states.");
    if (contract.functionalRequirements?.length > 0) {
      lines.push("- Core Functional States to manage in /script.js:");
      for (const fn of contract.functionalRequirements) {
        lines.push(`  * ${fn.name}: ${fn.expectedBehavior}`);
      }
    }
  } else if (filePath === "/styles.css") {
    lines.push("### File Responsibility: Foundation Stylesheet (/styles.css)");
    lines.push(`- Preferred Theme Mode: ${contract.design?.colorPreferences?.theme || "light"}`);
    lines.push(`- Container Max Width: ${contract.design?.layoutPreferences?.containerWidth || "max-w-7xl"}`);
    lines.push(`- Typography: ${contract.design?.typographyDirection?.preferredFonts?.join(", ") || "Clean system sans"}`);
  } else {
    // Component file: extract sections and functional requirements that match this component
    const baseName = filePath.split("/").pop().replace(/\.jsx?$/, "").toLowerCase();
    const matchingSections = [];

    for (const page of contract.pages || []) {
      for (const sec of page.sections || []) {
        const secId = (sec.id || "").toLowerCase();
        const secName = (sec.name || "").toLowerCase();
        if (secId.includes(baseName) || secName.includes(baseName) || baseName.includes(secId)) {
          matchingSections.push(sec);
        }
      }
    }

    const matchingFns = (contract.functionalRequirements || []).filter((fn) => {
      const target = (fn.implementationTarget || "").toLowerCase();
      const fnName = (fn.name || "").toLowerCase();
      const fnId = (fn.id || "").toLowerCase();
      return target.includes(baseName) || fnName.includes(baseName) || fnId.includes(baseName);
    });

    lines.push(`### File Contract Scope: ${filePath}`);
    if (matchingSections.length > 0) {
      lines.push("- Sections to implement in this component:");
      for (const sec of matchingSections) {
        lines.push(`  * ${sec.name}: ${sec.purpose}`);
        if (sec.requiredContent?.length > 0) {
          lines.push(`    Content: ${sec.requiredContent.join(", ")}`);
        }
      }
    }

    if (matchingFns.length > 0) {
      lines.push("- Functional Requirements for this component:");
      for (const fn of matchingFns) {
        lines.push(`  * ${fn.name}: ${fn.expectedBehavior}`);
      }
    }

    if (contract.content?.toneOfVoice) {
      lines.push(`- Tone of Voice: ${contract.content.toneOfVoice}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/**
 * Consistency Check: Verifies that every mandatory page and major section
 * in the Requirement Contract has a designated implementation file in the FilePlan.
 * Distinguishes between explicitly mapped items, auto-assigned fallbacks, and missing requirements.
 */
export function verifyFilePlanAlignment(plan, contract) {
  if (!plan || !Array.isArray(plan.files)) {
    return {
      aligned: false,
      fullyMapped: false,
      missingRequirements: ["Invalid plan: missing files array"],
      autoAssignedToApp: [],
      explicitlyMapped: [],
      warnings: ["Invalid plan: missing files array"],
      plan,
    };
  }

  if (!contract) {
    return {
      aligned: true,
      fullyMapped: true,
      missingRequirements: [],
      autoAssignedToApp: [],
      explicitlyMapped: [],
      warnings: [],
      plan,
    };
  }

  const plannedPaths = plan.files.map((f) => f.path);
  const plannedText = plan.files
    .map((f) => `${f.path} ${f.description || ""} ${(f.responsibilities || []).join(" ")}`)
    .join(" ")
    .toLowerCase();

  const missingRequirements = [];
  const autoAssignedToApp = [];
  const explicitlyMapped = [];
  const warnings = [];

  const isInteractiveApp =
    contract.identity?.category === "interactive_app" ||
    contract.identity?.category === "utility_game";

  // 1. Mandatory pages check (unconditional /App.js fallback removed)
  for (const page of contract.pages || []) {
    if (page.isPrimary) {
      const pageId = (page.id || "").toLowerCase();
      const pageName = (page.name || "").toLowerCase();
      const viewId = (page.viewId || "").toLowerCase();

      const isRepresented =
        plannedText.includes(pageId) ||
        plannedText.includes(pageName) ||
        (viewId && plannedText.includes(viewId)) ||
        plannedPaths.some((p) => {
          const lower = p.toLowerCase();
          return (
            lower.includes(pageId) ||
            (viewId && lower.includes(viewId)) ||
            lower.includes(pageName.replace(/\s+/g, ""))
          );
        });

      if (!isRepresented) {
        missingRequirements.push(`Page "${page.name}"`);
        warnings.push(`Primary page "${page.name}" is not explicitly represented in planned components or views`);
      } else {
        explicitlyMapped.push(`Page "${page.name}"`);
      }
    }
  }

  // 2. Mandatory sections check
  for (const page of contract.pages || []) {
    for (const sec of page.sections || []) {
      if (sec.priority === "mandatory") {
        const secName = sec.name.toLowerCase();
        const secId = (sec.id || "").toLowerCase();
        const secKey = secName.split(" ")[0];

        // Dedicated component check (excluding main entry files, styles, and scripts unless single-file app)
        const matchingFile = plan.files.find((f) => {
          if (f.path === "/App.js" || f.path === "/App.jsx" || f.path === "/index.html" || f.path === "/styles.css" || f.path === "/script.js") return false;
          const text = `${f.path} ${f.description || ""} ${(f.responsibilities || []).join(" ")}`.toLowerCase();
          return text.includes(secKey) || text.includes(secId) || text.includes(secName);
        });

        const hasDedicatedMatch = Boolean(matchingFile);
        const isComplexSection = /(catalog|grid|shop|store|cart|table|booking|reservation|checkout|dashboard|products)/i.test(
          sec.name + " " + sec.id
        );

        const mainEntry = plan.files.find((f) => f.path === "/App.jsx" || f.path === "/App.js" || f.path === "/index.html");

        if (hasDedicatedMatch) {
          explicitlyMapped.push(`Section "${sec.name}" (mapped to ${matchingFile.path})`);
        } else if (isInteractiveApp) {
          if (mainEntry) {
            explicitlyMapped.push(`Section "${sec.name}" (mapped to ${mainEntry.path})`);
          } else {
            missingRequirements.push(`Section "${sec.name}"`);
          }
        } else if (isComplexSection) {
          // Complex sections require a dedicated component and CANNOT be silently assigned to /App.js or /index.html
          missingRequirements.push(`Complex section "${sec.name}" requires dedicated component`);
          warnings.push(`Mandatory complex section "${sec.name}" is not mapped to a dedicated component`);
        } else {
          // Simple sections (hero, footer, cta) or vanilla sections can be auto-assigned to main entry if it exists
          if (mainEntry) {
            mainEntry.responsibilities = mainEntry.responsibilities || [];
            mainEntry.responsibilities.push(`Implement ${sec.name}: ${sec.purpose}`);
            autoAssignedToApp.push(`Section "${sec.name}"`);
            warnings.push(`Auto-assigned mandatory section "${sec.name}" to ${mainEntry.path} responsibilities`);
          } else {
            missingRequirements.push(`Section "${sec.name}"`);
          }
        }
      }
    }
  }

  // 3. Functional requirements check
  for (const fn of contract.functionalRequirements || []) {
    if (fn.priority === "mandatory") {
      const fnName = (fn.name || "").toLowerCase();
      const fnId = (fn.id || "").toLowerCase();
      const target = fn.implementationTarget || "";

      const matchingFile = plan.files.find((f) => {
        if (target && f.path === target) {
          if (target === "/App.js") return isInteractiveApp;
          return true;
        }
        if (f.path === "/App.js" || f.path === "/styles.css") return false;
        const text = `${f.path} ${f.description || ""} ${(f.responsibilities || []).join(" ")}`.toLowerCase();
        return text.includes(fnName) || text.includes(fnId);
      });

      const hasMatch = Boolean(matchingFile);
      const isComplexFn =
        /(ecommerce_cart|search_filtering|booking)/i.test(fn.category || "") ||
        /(cart|filter|checkout|booking|reservation)/i.test(fn.name + " " + fn.id);

      if (hasMatch) {
        explicitlyMapped.push(`Functional requirement "${fn.name}" (mapped to ${matchingFile.path})`);
      } else if (isInteractiveApp) {
        const appEntry = plan.files.find((f) => f.path === "/App.js");
        if (appEntry) {
          explicitlyMapped.push(`Functional requirement "${fn.name}" (mapped to /App.js)`);
        } else {
          missingRequirements.push(`Functional requirement "${fn.name}"`);
        }
      } else if (isComplexFn) {
        missingRequirements.push(`Complex functional requirement "${fn.name}" requires dedicated component implementation`);
        warnings.push(`Mandatory functional requirement "${fn.name}" is not mapped to a dedicated component`);
      } else {
        const appEntry = plan.files.find((f) => f.path === "/App.js");
        if (appEntry) {
          appEntry.responsibilities = appEntry.responsibilities || [];
          appEntry.responsibilities.push(`Handle ${fn.name}: ${fn.expectedBehavior || fn.description}`);
          autoAssignedToApp.push(`Functional requirement "${fn.name}"`);
          warnings.push(`Auto-assigned mandatory functional requirement "${fn.name}" to /App.js`);
        } else {
          missingRequirements.push(`Functional requirement "${fn.name}"`);
        }
      }
    }
  }

  const aligned = missingRequirements.length === 0;
  const fullyMapped = aligned && autoAssignedToApp.length === 0;

  return {
    aligned,
    fullyMapped,
    missingRequirements,
    autoAssignedToApp,
    explicitlyMapped,
    warnings,
    plan,
  };
}

/**
 * Updates the existing Requirement Contract in response to a revision prompt.
 * Preserves all unrelated existing requirements while updating only the aspects
 * explicitly targeted by the user's revision instruction.
 */
export function updateRequirementContractOnRevision(existingContract, revisionPrompt = "", currentDesignSpec = null) {
  // If no existing contract exists (e.g. legacy project), generate default baseline
  const baseContract = existingContract ? JSON.parse(JSON.stringify(existingContract)) : createDefaultRequirementContract(revisionPrompt);

  const p = revisionPrompt.toLowerCase();

  // 1. Theme revisions (e.g. "change to light theme", "make it dark mode")
  const wantsDark = /\b(dark|night|nocturnal|black|void)\b/i.test(p);
  const wantsLight = /\b(light|clean|white|bright|day)\b/i.test(p);

  if (wantsLight && !wantsDark) {
    baseContract.design = baseContract.design || {};
    baseContract.design.colorPreferences = baseContract.design.colorPreferences || {};
    baseContract.design.colorPreferences.theme = "light";
    baseContract.design.colorPreferences.origin = "explicit";
    baseContract.design.explicitDesignRequirements = [
      ...(baseContract.design.explicitDesignRequirements || []).filter((r) => !/dark/i.test(r)),
      "LIGHT color mode",
    ];
    baseContract.mandatoryRequirements = [
      ...(baseContract.mandatoryRequirements || []).filter((r) => !/dark/i.test(r)),
      "LIGHT visual theme",
    ];
  } else if (wantsDark && !wantsLight) {
    baseContract.design = baseContract.design || {};
    baseContract.design.colorPreferences = baseContract.design.colorPreferences || {};
    baseContract.design.colorPreferences.theme = "dark";
    baseContract.design.colorPreferences.origin = "explicit";
    baseContract.design.explicitDesignRequirements = [
      ...(baseContract.design.explicitDesignRequirements || []).filter((r) => !/light/i.test(r)),
      "DARK color mode",
    ];
    baseContract.mandatoryRequirements = [
      ...(baseContract.mandatoryRequirements || []).filter((r) => !/light/i.test(r)),
      "DARK visual theme",
    ];
  }

  // 2. Feature / Section additions (e.g. "add a contact form", "add reviews section", "add FAQ accordion")
  const addsContact = /\b(add|include|insert)\b.*\b(contact\s*form|contact\s*us|get\s*in\s*touch)\b/i.test(p) ||
    (!/\b(remove|delete|drop|eliminate|hide)\b/i.test(p) && /\b(contact\s*form|contact\s*us|get\s*in\s*touch)\b/i.test(p));
  const addsReviews = /\b(add|include|insert)\b.*\b(reviews?|testimonials?|social\s*proof)\b/i.test(p) ||
    (!/\b(remove|delete|drop|eliminate|hide)\b/i.test(p) && /\b(reviews?|testimonials?|social\s*proof)\b/i.test(p));
  const addsFaq = /\b(add|include|insert)\b.*\b(faq|frequently\s*asked|accordions?)\b/i.test(p) ||
    (!/\b(remove|delete|drop|eliminate|hide)\b/i.test(p) && /\b(faq|frequently\s*asked|accordions?)\b/i.test(p));

  const primaryPage = baseContract.pages?.[0];
  if (primaryPage) {
    primaryPage.sections = primaryPage.sections || [];

    if (addsContact && !primaryPage.sections.some((s) => /contact/i.test(s.name))) {
      primaryPage.sections.push({
        id: "contact_section",
        name: "Contact Section",
        order: primaryPage.sections.length + 1,
        purpose: "User inquiry and message submission form",
        requiredContent: ["Name", "Email", "Message input", "Submit button"],
        callToAction: "Send Message",
        supportingElements: ["Input validation", "Success message"],
        priority: "mandatory",
      });
      baseContract.functionalRequirements = baseContract.functionalRequirements || [];
      baseContract.functionalRequirements.push({
        id: "contact_form_submission",
        name: "Contact Form Validation",
        description: "Validates inputs and handles submission with feedback toast",
        category: "forms_validation",
        expectedBehavior: "Validates required inputs and displays feedback toast on submit",
        priority: "mandatory",
        implementationTarget: "/components/Contact.js",
      });
      baseContract.mandatoryRequirements = baseContract.mandatoryRequirements || [];
      baseContract.mandatoryRequirements.push("Contact inquiry form");
    }

    if (addsReviews && !primaryPage.sections.some((s) => /reviews|testimonials/i.test(s.name))) {
      primaryPage.sections.push({
        id: "testimonials_section",
        name: "Reviews & Testimonials",
        order: primaryPage.sections.length + 1,
        purpose: "Social proof showcasing customer quotes and ratings",
        requiredContent: ["User quotes", "Author names", "Rating stars"],
        callToAction: "",
        supportingElements: ["Rating stars", "Avatar images"],
        priority: "mandatory",
      });
      baseContract.mandatoryRequirements = baseContract.mandatoryRequirements || [];
      baseContract.mandatoryRequirements.push("Customer reviews and testimonials section");
    }

    if (addsFaq && !primaryPage.sections.some((s) => /faq/i.test(s.name) || /faq/i.test(s.id))) {
      primaryPage.sections.push({
        id: "faq_section",
        name: "Frequently Asked Questions (FAQ)",
        order: primaryPage.sections.length + 1,
        purpose: "Accordion addressing common customer questions",
        requiredContent: ["Questions", "Answers"],
        callToAction: "",
        supportingElements: ["Expandable accordion items"],
        priority: "mandatory",
      });
      baseContract.functionalRequirements = baseContract.functionalRequirements || [];
      baseContract.functionalRequirements.push({
        id: "faq_accordion",
        name: "Interactive FAQ Accordion",
        description: "Expand and collapse question items smoothly",
        category: "tabs_accordions",
        expectedBehavior: "Clicking a question toggles its answer visibility",
        priority: "mandatory",
        implementationTarget: "/components/Faq.js",
      });
      baseContract.mandatoryRequirements = baseContract.mandatoryRequirements || [];
      baseContract.mandatoryRequirements.push("FAQ Accordion section");
    }
  }

  // 3. Feature / Section removals (e.g. "remove contact form", "remove FAQ", "delete testimonials", "remove cart")
  const removesContact = /\b(remove|delete|drop|eliminate|hide|exclude)\b.*\b(contact|inquiry|contact\s*form)\b/i.test(p);
  const removesFaq = /\b(remove|delete|drop|eliminate|hide|exclude)\b.*\b(faq|frequently\s*asked|questions?|accordion)\b/i.test(p);
  const removesReviews = /\b(remove|delete|drop|eliminate|hide|exclude)\b.*\b(reviews?|testimonials?|social\s*proof)\b/i.test(p);
  const removesCart = /\b(remove|delete|drop|eliminate|hide|exclude)\b.*\b(cart|bag|checkout|shopping\s*cart)\b/i.test(p);

  if (removesContact) {
    for (const page of baseContract.pages || []) {
      page.sections = (page.sections || []).filter((s) => !/contact/i.test(s.id + " " + s.name));
    }
    baseContract.functionalRequirements = (baseContract.functionalRequirements || []).filter(
      (f) => !/contact/i.test(f.id + " " + f.name)
    );
    baseContract.mandatoryRequirements = (baseContract.mandatoryRequirements || []).filter(
      (m) => !/contact/i.test(m)
    );
    baseContract.optionalEnhancements = (baseContract.optionalEnhancements || []).filter(
      (o) => !/contact/i.test(o)
    );
  }

  if (removesFaq) {
    for (const page of baseContract.pages || []) {
      page.sections = (page.sections || []).filter((s) => !/faq|question/i.test(s.id + " " + s.name));
    }
    baseContract.functionalRequirements = (baseContract.functionalRequirements || []).filter(
      (f) => !/faq|accordion/i.test(f.id + " " + f.name)
    );
    baseContract.mandatoryRequirements = (baseContract.mandatoryRequirements || []).filter(
      (m) => !/faq|accordion/i.test(m)
    );
    baseContract.optionalEnhancements = (baseContract.optionalEnhancements || []).filter(
      (o) => !/faq/i.test(o)
    );
  }

  if (removesReviews) {
    for (const page of baseContract.pages || []) {
      page.sections = (page.sections || []).filter((s) => !/reviews?|testimonials?|social\s*proof/i.test(s.id + " " + s.name));
    }
    baseContract.functionalRequirements = (baseContract.functionalRequirements || []).filter(
      (f) => !/reviews?|testimonials?/i.test(f.id + " " + f.name)
    );
    baseContract.mandatoryRequirements = (baseContract.mandatoryRequirements || []).filter(
      (m) => !/reviews?|testimonials?/i.test(m)
    );
  }

  if (removesCart) {
    for (const page of baseContract.pages || []) {
      page.sections = (page.sections || []).filter((s) => !/cart|bag|checkout/i.test(s.id + " " + s.name));
    }
    baseContract.functionalRequirements = (baseContract.functionalRequirements || []).filter(
      (f) => !/cart|bag|checkout/i.test(f.id + " " + f.name)
    );
    baseContract.mandatoryRequirements = (baseContract.mandatoryRequirements || []).filter(
      (m) => !/cart|bag|checkout/i.test(m)
    );
  }

  // Validate the updated contract with schema to ensure integrity
  return RequirementContractSchema.parse(baseContract);
}
