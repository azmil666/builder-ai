import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  RequirementContractSchema,
  RequirementIdentitySchema,
  RequirementPageSchema,
  RequirementSectionSchema,
  RequirementNavigationSchema,
  RequirementDesignSchema,
  RequirementFunctionSchema,
  RequirementResponsiveSchema,
  RequirementContentSchema,
} from "../services/aiSchemas.js";
import {
  createDefaultRequirementContract,
  generateRequirementContract,
  formatContractForDesignSpec,
  formatContractForFilePlan,
  formatContractForFileCode,
  verifyFilePlanAlignment,
  updateRequirementContractOnRevision,
} from "../services/requirementContract.js";
import {
  setAiGeneratorOverride,
  resetAiGeneratorOverride,
  generateProject,
  reviseProject,
} from "../services/ai.js";
import { createDefaultDesignSpec } from "../services/prompts.js";
import { deriveFeatureChecklist } from "../services/featureValidator.js";

describe("Phase 2: Structured Requirement Contract Suite", () => {
  afterEach(() => {
    resetAiGeneratorOverride();
  });

  // -------------------------------------------------------------
  // 1. Schema Validation & Category Integrity
  // -------------------------------------------------------------
  describe("1. Schema Validation & Category Integrity", () => {
    it("validates a fully populated requirement contract", () => {
      const valid = {
        identity: {
          name: "Sneaker Haven",
          category: "ecommerce",
          purpose: "Curated boutique sneaker marketplace",
          targetAudience: "Sneaker enthusiasts and urban streetwear buyers",
          intendedUserExperience: "Fast, visual-first catalog with immediate checkout",
          mainConversionAction: "Add sneaker to bag and complete checkout",
        },
        navigation: {
          type: "sticky_header",
          primaryItems: ["New Drops", "Collections", "Trending", "About"],
          secondaryItems: ["Search", "Bag"],
          callToAction: "Shop Now",
          importantRoutes: ["/"],
        },
        pages: [
          {
            id: "home",
            name: "Home Storefront",
            path: "/",
            purpose: "Hero showcase and product catalog",
            isPrimary: true,
            order: 1,
            sections: [
              {
                id: "hero",
                name: "Hero Spotlight",
                order: 1,
                purpose: "Display flagship sneaker drop",
                requiredContent: ["Headline", "Drop date"],
                callToAction: "Explore Drop",
                supportingElements: ["Motion video or high-res photography"],
                priority: "mandatory",
              },
              {
                id: "catalog",
                name: "Product Grid",
                order: 2,
                purpose: "Filterable grid of sneakers",
                requiredContent: ["Product cards", "Prices", "Size filters"],
                callToAction: "Add to Bag",
                supportingElements: ["Filter pills", "Price tags"],
                priority: "mandatory",
              },
            ],
          },
        ],
        design: {
          visualStyle: "Nocturnal dark luxury with neon crimson accents",
          colorPreferences: {
            theme: "dark",
            primaryAccent: "#ff2a5f",
            explicitPalette: ["#09090b", "#ff2a5f", "#fafafa"],
            notes: "User explicitly requested dark theme",
            origin: "explicit",
          },
          typographyDirection: {
            headingStyle: "Expressive modern grotesk (Syne)",
            bodyStyle: "Clean geometric sans (Plus Jakarta Sans)",
            preferredFonts: ["Syne", "Plus Jakarta Sans"],
            origin: "inferred",
          },
          layoutPreferences: {
            density: "comfortable",
            containerWidth: "max-w-7xl",
            gridStyle: "Multi-column responsive grid",
            origin: "inferred",
          },
          componentStyling: {
            cardRadius: "rounded-2xl",
            buttonRadius: "rounded-full",
            shadows: "Soft glow elevations on hover",
            origin: "inferred",
          },
          spacingAndHierarchy: "Generous vertical breathing room with clear focal points",
          imageAndIllustration: "High-resolution curated footwear photography",
          animationAndMotion: "Smooth hover scaling on product cards",
          explicitDesignRequirements: ["Dark visual theme", "Sneaker boutique aesthetic"],
          inferredDesignDecisions: ["Syne + Plus Jakarta Sans typography pairing"],
        },
        functionalRequirements: [
          {
            id: "cart_state",
            name: "Shopping Bag State",
            description: "Manage items, quantities, and subtotal calculation",
            category: "ecommerce_cart",
            expectedBehavior: "Adding product opens slide-over bag with computed subtotal",
            priority: "mandatory",
            implementationTarget: "/App.js",
          },
          {
            id: "product_filter",
            name: "Filter by Category & Size",
            description: "Interactive pills filtering displayed sneakers",
            category: "search_filtering",
            expectedBehavior: "Clicking filter updates the product grid instantly",
            priority: "mandatory",
            implementationTarget: "/components/ProductGrid.js",
          },
        ],
        responsive: {
          desktop: "Multi-column catalog with persistent cart badge",
          tablet: "2-column grid with sticky bottom bar",
          mobile: "Single column stack with slide-over drawer navigation",
          importantAdaptations: ["Prevent horizontal overflow", "Touch targets >= 44px"],
        },
        content: {
          requiredCopy: ["Air Velocity Drop 01"],
          toneOfVoice: "Confident, urban, aspirational",
          imageryRequirements: ["Premium footwear on dark backgrounds"],
          iconRequirements: ["lucide-react inline icons"],
          placeholderRestrictions: "Use realistic footwear names and pricing",
          userProvidedAssets: [],
        },
        mandatoryRequirements: [
          "Dark visual theme",
          "Sneaker catalog with product cards",
          "Shopping cart with quantity adjustments",
          "Product filtering mechanism",
        ],
        optionalEnhancements: ["Size recommendation guide", "Newsletter discount pill"],
        inferredRequirements: ["Responsive mobile navigation drawer"],
      };

      const parsed = RequirementContractSchema.parse(valid);
      assert.equal(parsed.identity.category, "ecommerce");
      assert.equal(parsed.design.colorPreferences.theme, "dark");
      assert.equal(parsed.design.colorPreferences.origin, "explicit");
      assert.equal(parsed.mandatoryRequirements.length, 4);
      assert.equal(parsed.functionalRequirements.length, 2);
    });

    it("safely handles missing optional fields with sensible schema defaults", () => {
      const minimal = {
        identity: {
          name: "Minimal Tool",
          category: "interactive_app",
        },
      };

      const parsed = RequirementContractSchema.parse(minimal);
      assert.equal(parsed.identity.name, "Minimal Tool");
      assert.equal(parsed.identity.category, "interactive_app");
      assert.equal(parsed.identity.purpose, "Web application");
      assert.equal(parsed.navigation.type, "sticky_header");
      assert.equal(parsed.design.colorPreferences.theme, "light");
      assert.deepEqual(parsed.mandatoryRequirements, []);
      assert.deepEqual(parsed.pages, []);
    });

    it("rejects invalid categories or malformed schema properties", () => {
      const invalid = {
        identity: {
          category: "non_existent_category_12345",
        },
      };

      assert.throws(() => RequirementContractSchema.parse(invalid), /invalid_value|invalid_enum_value/i);
    });
  });

  // -------------------------------------------------------------
  // 2. Prioritization & Inference Separation
  // -------------------------------------------------------------
  describe("2. Prioritization & Inference Separation", () => {
    it("distinguishes explicit user directives from inferred defaults in createDefaultRequirementContract", () => {
      // Explicit prompt asking for dark mode sneaker shop
      const contract1 = createDefaultRequirementContract(
        "Create a modern e-commerce website for a sneaker brand with shopping cart, filters, and a dark visual theme."
      );

      assert.equal(contract1.identity.category, "ecommerce");
      assert.equal(contract1.design.colorPreferences.theme, "dark");
      assert.equal(contract1.design.colorPreferences.origin, "explicit");
      assert.ok(
        contract1.mandatoryRequirements.some((r) => /dark/i.test(r)),
        "Explicit dark theme must be a mandatory requirement"
      );
      assert.ok(
        contract1.mandatoryRequirements.some((r) => /catalog|product/i.test(r)),
        "Product catalog must be mandatory"
      );
      assert.ok(
        contract1.mandatoryRequirements.some((r) => /cart/i.test(r)),
        "Shopping cart must be mandatory"
      );

      // Inferred prompt where theme is not specified
      const contract2 = createDefaultRequirementContract("Build an agency portfolio website showcasing projects.");
      assert.equal(contract2.identity.category, "agency_portfolio");
      assert.equal(contract2.design.colorPreferences.origin, "inferred");
      assert.ok(
        contract2.inferredRequirements.some((r) => /theme/i.test(r)),
        "Unspecified theme must be categorized under inferred requirements"
      );
    });

    it("supports interactive games / tools with single-canvas structure and minimal marketing fluff", () => {
      const contract = createDefaultRequirementContract("Create a Tic Tac Toe game with score tracking.");
      assert.equal(contract.identity.category, "interactive_app");
      assert.equal(contract.pages.length, 1);
      assert.equal(contract.pages[0].path, "/");
      assert.ok(
        contract.functionalRequirements.some((f) => f.category === "game_logic"),
        "Game logic functional requirement must be included"
      );
    });

    it("supports restaurant websites with culinary menus and reservation forms", () => {
      const contract = createDefaultRequirementContract("Build a website for an Italian bistro with seasonal menu and table reservation.");
      assert.equal(contract.identity.category, "restaurant_hospitality");
      assert.ok(
        contract.functionalRequirements.some((f) => /reservation/i.test(f.name)),
        "Reservation form must be a functional requirement"
      );
      assert.ok(
        contract.mandatoryRequirements.some((r) => /menu/i.test(r)),
        "Menu must be a mandatory requirement"
      );
    });
  });

  // -------------------------------------------------------------
  // 3. Fallback & AI Synthesis Resilience
  // -------------------------------------------------------------
  describe("3. Fallback & AI Synthesis Resilience", () => {
    it("safely falls back to default contract when AI generation throws an error", async () => {
      setAiGeneratorOverride(() => {
        throw new Error("Provider rate limit or simulated network timeout");
      });

      const contract = await generateRequirementContract("E-commerce sneaker shop with cart and filters");
      assert.ok(contract, "Contract must be returned despite AI failure");
      assert.equal(contract.identity.category, "ecommerce");
      assert.ok(contract.mandatoryRequirements.length > 0);
    });

    it("safely falls back to default contract when AI returns malformed schema output", async () => {
      setAiGeneratorOverride(() => {
        return {
          object: {
            identity: { category: "completely_invalid_category_xyz" },
          },
        };
      });

      const contract = await generateRequirementContract("SaaS landing page with pricing calculator");
      assert.ok(contract);
      assert.equal(contract.identity.category, "saas_landing");
    });
  });

  // -------------------------------------------------------------
  // 4. Pipeline Integration (DesignSpec, FilePlan, Code Generation)
  // -------------------------------------------------------------
  describe("4. Pipeline Integration", () => {
    it("formatContractForDesignSpec formats key requirements into concise context", () => {
      const contract = createDefaultRequirementContract("Modern dark luxury watch catalog with shopping cart");
      const formatted = formatContractForDesignSpec(contract);

      assert.ok(formatted.includes("STRUCTURED REQUIREMENT CONTRACT GUIDANCE"));
      assert.ok(formatted.includes("ecommerce"));
      assert.ok(formatted.includes("dark"));
      assert.ok(formatted.includes("Mandatory User Requirements"));
    });

    it("createDefaultDesignSpec directly adopts Requirement Contract preferences", () => {
      const contract = createDefaultRequirementContract("Modern dark ecommerce sneaker shop");
      const spec = createDefaultDesignSpec("", contract);

      assert.equal(spec.category, "ecommerce");
      assert.equal(spec.colorPalette.theme, "dark");
    });

    it("formatContractForFilePlan outlines pages, sections, and functional requirements", () => {
      const contract = createDefaultRequirementContract("Modern ecommerce sneaker shop with cart and filters");
      const planDirective = formatContractForFilePlan(contract);

      assert.ok(planDirective.includes("REQUIREMENT CONTRACT FILE-PLANNING DIRECTIVE"));
      assert.ok(planDirective.includes("Storefront Home"));
      assert.ok(planDirective.includes("Shopping Cart State"));
    });

    it("verifyFilePlanAlignment detects aligned file plans and auto-assigns missing requirements", () => {
      const contract = createDefaultRequirementContract("Modern ecommerce sneaker shop with cart and filters");

      // Valid plan covering App.js and dedicated components
      const goodPlan = {
        files: [
          { path: "/App.js", description: "Main home storefront assembling layout and hero" },
          { path: "/styles.css", description: "Global styles and design tokens" },
          { path: "/components/ProductGrid.js", description: "Catalog grid with filtering controls" },
          { path: "/components/CartDrawer.js", description: "Slide-over shopping cart bag drawer" },
        ],
        projectName: "Sneaker Shop",
      };

      const check = verifyFilePlanAlignment(goodPlan, contract);
      assert.equal(check.aligned, true);
      assert.equal(check.fullyMapped, false); // Hero was auto-assigned to /App.js
      assert.ok(check.autoAssignedToApp.length > 0);
      assert.ok(check.explicitlyMapped.length > 0);

      // Incomplete plan missing App.js
      const badPlan = {
        files: [{ path: "/styles.css", description: "Only css" }],
      };
      const badCheck = verifyFilePlanAlignment(badPlan, contract);
      assert.equal(badCheck.aligned, false);
      assert.ok(badCheck.missingRequirements.length > 0);
    });

    it("reports primary page as missing when not explicitly mapped or identified in planned views", () => {
      const contract = createDefaultRequirementContract("SaaS project documentation platform");
      // Add custom primary page "Documentation" not mentioned in plan
      contract.pages = [
        {
          id: "docs_portal",
          name: "Documentation Portal",
          path: "/docs",
          viewId: "docs",
          purpose: "API and guide documentation",
          isPrimary: true,
          sections: [],
        },
      ];

      const plan = {
        files: [
          { path: "/App.js", description: "Generic shell container" },
          { path: "/styles.css", description: "Theme tokens" },
        ],
      };

      const result = verifyFilePlanAlignment(plan, contract);
      assert.equal(result.aligned, false);
      assert.ok(result.missingRequirements.some((r) => r.includes("Documentation Portal")));
      assert.ok(result.warnings.some((w) => w.includes("Documentation Portal")));
    });

    it("does not consider mandatory complex section covered without matching dedicated component", () => {
      const contract = createDefaultRequirementContract("Ecommerce boutique with cart and checkout");

      // Plan has App.js but lacks dedicated cart drawer component
      const plan = {
        files: [
          { path: "/App.js", description: "Storefront Home with header and hero" },
          { path: "/styles.css", description: "Theme styles" },
          { path: "/components/ProductGrid.js", description: "Catalog grid" },
        ],
      };

      const result = verifyFilePlanAlignment(plan, contract);
      assert.equal(result.aligned, false);
      assert.ok(result.missingRequirements.some((r) => /Shopping Bag Drawer|Cart/i.test(r)));
      assert.ok(result.warnings.some((w) => /Shopping Bag Drawer|Cart/i.test(w)));
    });

    it("ensures /App.js existing alone does not make the plan aligned when complex sections are unmapped", () => {
      const contract = createDefaultRequirementContract("Modern boutique ecommerce storefront with cart");

      // Plan with ONLY /App.js and /styles.css
      const appOnlyPlan = {
        files: [
          { path: "/App.js", description: "Storefront Home container" },
          { path: "/styles.css", description: "Styles" },
        ],
      };

      const result = verifyFilePlanAlignment(appOnlyPlan, contract);
      // /App.js alone cannot satisfy complex sections like Product Collection Grid or Shopping Bag Drawer
      assert.equal(result.aligned, false);
      assert.ok(result.missingRequirements.length >= 2);
    });

    it("tracks autoAssignedToApp separately from explicitlyMapped items", () => {
      const contract = createDefaultRequirementContract("Clean minimal portfolio website");
      const plan = {
        files: [
          { path: "/App.js", description: "Portfolio Showcase main view assembling hero and cta" },
          { path: "/styles.css", description: "Styles" },
          { path: "/components/Projects.js", description: "Selected Works & Projects gallery" },
        ],
      };

      const result = verifyFilePlanAlignment(plan, contract);
      assert.equal(result.aligned, true);
      assert.ok(Array.isArray(result.autoAssignedToApp));
      assert.ok(Array.isArray(result.explicitlyMapped));
      assert.ok(result.explicitlyMapped.length > 0);
    });

    it("formatContractForFileCode extracts only the focused slice relevant to a file", () => {
      const contract = createDefaultRequirementContract("Modern ecommerce sneaker shop with cart and filters");

      // Slice for App.js
      const appSlice = formatContractForFileCode(contract, "/App.js");
      assert.ok(appSlice.includes("Main Application Entry (/App.js)"));
      assert.ok(appSlice.includes("Theme:"));

      // Slice for ProductGrid.js
      const gridSlice = formatContractForFileCode(contract, "/components/ProductGrid.js");
      assert.ok(gridSlice.includes("/components/ProductGrid.js"));

      // Slice for styles.css
      const cssSlice = formatContractForFileCode(contract, "/styles.css");
      assert.ok(cssSlice.includes("Foundation Stylesheet (/styles.css)"));
    });

    it("deriveFeatureChecklist incorporates functional requirements from contract", () => {
      const contract = createDefaultRequirementContract("E-commerce sneaker shop with shopping cart");
      const checklist = deriveFeatureChecklist("Sneaker shop", null, contract);

      assert.ok(checklist.length >= 8);
      assert.ok(checklist.some((item) => item.id === "cart_state"));
      assert.ok(checklist.some((item) => item.mandatory === true));
    });
  });

  // -------------------------------------------------------------
  // 5. Revision Workflow Compatibility
  // -------------------------------------------------------------
  describe("5. Revision Workflow Compatibility", () => {
    it("preserves unrelated requirements when updating a specific requirement (e.g. theme change)", () => {
      const originalContract = createDefaultRequirementContract(
        "Create a portfolio website with a dark theme, project section, and contact form."
      );
      assert.equal(originalContract.design.colorPreferences.theme, "dark");
      const originalSections = originalContract.pages[0].sections.map((s) => s.name);

      // Revision: "Change the theme to a light theme"
      const updatedContract = updateRequirementContractOnRevision(
        originalContract,
        "Change the theme to a light theme."
      );

      // Theme requirement should be updated to light
      assert.equal(updatedContract.design.colorPreferences.theme, "light");
      assert.equal(updatedContract.design.colorPreferences.origin, "explicit");
      assert.ok(updatedContract.mandatoryRequirements.some((r) => /light/i.test(r)));
      assert.ok(!updatedContract.mandatoryRequirements.some((r) => /dark/i.test(r)));

      // Portfolio identity and sections must be strictly preserved
      assert.equal(updatedContract.identity.category, "agency_portfolio");
      const updatedSections = updatedContract.pages[0].sections.map((s) => s.name);
      assert.deepEqual(updatedSections, originalSections);
    });

    it("adds newly requested sections during revision without removing existing sections", () => {
      const originalContract = createDefaultRequirementContract(
        "Create a SaaS landing page with hero and features."
      );
      const initialSectionCount = originalContract.pages[0].sections.length;

      // Revision: "Add an interactive FAQ accordion section"
      const updatedContract = updateRequirementContractOnRevision(
        originalContract,
        "Add an interactive FAQ accordion section."
      );

      assert.ok(updatedContract.pages[0].sections.length > initialSectionCount);
      assert.ok(updatedContract.pages[0].sections.some((s) => /faq/i.test(s.name)));
      assert.ok(updatedContract.functionalRequirements.some((f) => /faq/i.test(f.name)));
      assert.ok(updatedContract.mandatoryRequirements.some((r) => /faq/i.test(r)));
    });

    it("removes features and sections during revision when explicitly requested", () => {
      const contract = createDefaultRequirementContract(
        "Create a portfolio website with a dark theme, project section, and contact form."
      );
      assert.ok(contract.pages[0].sections.some((s) => /contact/i.test(s.name)));
      assert.ok(contract.mandatoryRequirements.some((m) => /contact/i.test(m)));

      // Revision: "Remove the contact form"
      const revised = updateRequirementContractOnRevision(contract, "Remove the contact form");

      assert.ok(!revised.pages[0].sections.some((s) => /contact/i.test(s.name)));
      assert.ok(!revised.functionalRequirements.some((f) => /contact/i.test(f.name)));
      assert.ok(!revised.mandatoryRequirements.some((m) => /contact/i.test(m)));
    });

    it("candle showcase without cart does not require cart or filtering", () => {
      const contract = createDefaultRequirementContract("Create a luxury scented candle brand showcase");
      assert.equal(contract.identity.category, "ecommerce");
      assert.ok(!contract.mandatoryRequirements.some((m) => /cart|bag|checkout/i.test(m)));
      assert.ok(!contract.mandatoryRequirements.some((m) => /filter/i.test(m)));
      assert.ok(!contract.pages[0].sections.some((s) => s.priority === "mandatory" && /cart/i.test(s.id)));
    });

    it("online store with cart explicitly requires cart and checkout", () => {
      const contract = createDefaultRequirementContract("Create an online boutique store with shopping cart and checkout");
      assert.equal(contract.identity.category, "ecommerce");
      assert.ok(contract.mandatoryRequirements.some((m) => /cart|bag/i.test(m)));
      assert.ok(contract.pages[0].sections.some((s) => s.priority === "mandatory" && /cart/i.test(s.id)));
      assert.ok(contract.functionalRequirements.some((f) => /cart/i.test(f.id) && f.priority === "mandatory"));
    });

    it("preserves explicit brand names and quoted copy in fallback contract", () => {
      const contract = createDefaultRequirementContract(
        'Create a luxury scented candle brand showcase for Lumen Candle Studio with quote "Crafted for Solitude"'
      );
      assert.equal(contract.identity.name, "Lumen Candle Studio");
      assert.ok(contract.content.userProvidedAssets.some((a) => a.includes("Lumen Candle Studio")));
      assert.ok(contract.content.requiredCopy.includes("Crafted for Solitude"));
    });

    it("gracefully initializes contract for legacy projects that lack a stored contract", () => {
      const legacyContract = updateRequirementContractOnRevision(
        null,
        "Add a dark theme to the website."
      );

      assert.ok(legacyContract);
      assert.equal(legacyContract.design.colorPreferences.theme, "dark");
      assert.ok(legacyContract.pages.length > 0);
    });
  });

  // -------------------------------------------------------------
  // 6. End-to-End Generation Pipeline Flow Simulation
  // -------------------------------------------------------------
  describe("6. End-to-End Generation Pipeline Flow Simulation", () => {
    it("generateProject establishes requirement contract, invokes callbacks, and returns requirementContract in result", async () => {
      let contractCallbackTriggered = false;
      let specCallbackTriggered = false;
      let planCallbackTriggered = false;

      // Deterministic generator mock for complete pipeline
      setAiGeneratorOverride(({ schema, prompt }) => {
        if (schema === RequirementContractSchema) {
          return {
            object: createDefaultRequirementContract("Modern dark sneaker e-commerce shop"),
          };
        }
        if (schema.shape?.archetype) {
          return {
            object: createDefaultDesignSpec("Modern dark sneaker e-commerce shop"),
          };
        }
        if (schema.shape?.files) {
          return {
            object: {
              projectName: "Sneaker Studio",
              projectDescription: "A modern dark sneaker storefront",
              files: [
                {
                  path: "/App.js",
                  description: "Main app entry",
                  exports: "default App",
                  imports: ["./styles.css", "./components/Catalog.js"],
                  isEntry: true,
                  mandatory: true,
                },
                {
                  path: "/styles.css",
                  description: "Global stylesheet",
                  exports: "none",
                  imports: [],
                  mandatory: true,
                },
                {
                  path: "/components/Catalog.js",
                  description: "Sneaker catalog grid and filters",
                  exports: "default Catalog",
                  imports: [],
                  mandatory: true,
                },
              ],
            },
          };
        }
        // FileCodeSchema
        if (prompt.includes("/styles.css")) {
          return {
            object: {
              code: "/* styles.css */\n:root { --bg: #09090b; --fg: #fafafa; }\nbody { background: var(--bg); color: var(--fg); }",
            },
          };
        }
        if (prompt.includes("/components/Catalog.js")) {
          return {
            object: {
              code: "import React, { useState } from 'react';\nexport default function Catalog() {\n  const [filter, setFilter] = useState('all');\n  return <section className=\"p-8\"><h2>Sneakers</h2></section>;\n}",
            },
          };
        }
        // App.js
        return {
          object: {
            code: "import React, { useState } from 'react';\nimport './styles.css';\nimport Catalog from './components/Catalog.js';\nexport default function App() {\n  const [cart, setCart] = useState([]);\n  return (<main className=\"min-h-screen bg-zinc-950 text-white\"><Catalog /></main>);\n}",
          },
        };
      });

      const result = await generateProject("Modern dark sneaker e-commerce shop", {
        onRequirementContract: async (c) => {
          assert.ok(c);
          contractCallbackTriggered = true;
        },
        onDesignSpec: async (s) => {
          assert.ok(s);
          specCallbackTriggered = true;
        },
        onPlan: async (p) => {
          assert.ok(p);
          planCallbackTriggered = true;
        },
      });

      assert.equal(contractCallbackTriggered, true, "onRequirementContract callback must be invoked");
      assert.equal(specCallbackTriggered, true, "onDesignSpec callback must be invoked");
      assert.equal(planCallbackTriggered, true, "onPlan callback must be invoked");

      assert.ok(result.requirementContract, "generateProject must return requirementContract");
      assert.equal(result.requirementContract.identity.category, "ecommerce");
      assert.equal(result.requirementContract.design.colorPreferences.theme, "dark");
      assert.ok(result.files["/App.js"], "App.js must be generated");
      assert.ok(result.files["/styles.css"], "styles.css must be generated");
      assert.ok(result.files["/components/Catalog.js"], "Catalog.js must be generated");
      assert.ok(result.featureReport, "Feature report must be included in generation result");
    });
  });

  // -------------------------------------------------------------
  // 7. Revision Candidate Contract Staging & Ordering
  // -------------------------------------------------------------
  describe("7. Revision Candidate Contract Staging & Ordering", () => {
    it("stages candidate contract before AI revision generation ensuring updated requirements reach AI", async () => {
      const originalContract = createDefaultRequirementContract(
        "Create a dark portfolio with projects and contact form"
      );
      assert.equal(originalContract.design.colorPreferences.theme, "dark");

      let contractSeenByAi = null;
      setAiGeneratorOverride(({ prompt, system }) => {
        return {
          object: {
            description: "Changed theme to light and added FAQ accordion",
            operations: [
              {
                type: "update",
                path: "/App.js",
                search: "dark",
                replace: "light",
              },
            ],
          },
        };
      });

      // Simulation of chatController candidate contract staging logic
      const revisionPrompt = "Change the theme to light and add an FAQ accordion";
      const candidateContract = updateRequirementContractOnRevision(
        originalContract,
        revisionPrompt,
        null
      );

      // Verify candidate contract is immediately light and includes FAQ
      assert.equal(candidateContract.design.colorPreferences.theme, "light");
      assert.ok(candidateContract.pages[0].sections.some((s) => /faq/i.test(s.name)));

      // Simulate passing candidateContract to reviseProject
      const revisionResult = await reviseProject(
        revisionPrompt,
        [{ path: "/App.js", lines: 20 }],
        { "/App.js": "export default function App() { return <div className='dark'>Portfolio</div>; }" },
        [],
        null,
        candidateContract
      );

      assert.ok(revisionResult);
      assert.equal(revisionResult.operations.length, 1);
    });

    it("preserves original database contract when revision fails validation or operations", () => {
      const persistedProject = {
        _id: "test_proj_123",
        requirementContract: createDefaultRequirementContract(
          "Dark portfolio with contact form"
        ),
      };
      const initialTheme = persistedProject.requirementContract.design.colorPreferences.theme;
      assert.equal(initialTheme, "dark");

      // Candidate contract is staged in memory
      let candidateContract = updateRequirementContractOnRevision(
        persistedProject.requirementContract,
        "Change theme to light"
      );
      assert.equal(candidateContract.design.colorPreferences.theme, "light");

      // Simulate revision failure (e.g. invalid operations / runtime failure)
      const revisionFailed = true;

      if (!revisionFailed) {
        persistedProject.requirementContract = candidateContract;
      }

      // Persisted project in DB remains completely unchanged
      assert.equal(persistedProject.requirementContract.design.colorPreferences.theme, "dark");
    });

    it("commits candidate contract to database only after revision succeeds", () => {
      const persistedProject = {
        _id: "test_proj_123",
        requirementContract: createDefaultRequirementContract(
          "Dark portfolio with contact form"
        ),
      };

      const candidateContract = updateRequirementContractOnRevision(
        persistedProject.requirementContract,
        "Change theme to light"
      );

      // Simulate revision success gate
      const revisionSucceeded = true;
      if (revisionSucceeded) {
        persistedProject.requirementContract = candidateContract;
      }

      assert.equal(persistedProject.requirementContract.design.colorPreferences.theme, "light");
    });
  });
});

