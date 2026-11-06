import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  RequirementVerificationSummarySchema,
  RequirementVerificationItemSchema,
} from "../services/aiSchemas.js";
import { createDefaultRequirementContract } from "../services/requirementContract.js";
import {
  verifyProjectRequirements,
  analyzeFileCode,
  buildProjectAnalysisMap,
  verifyWithAiFallback,
  calculateVerificationSummary,
} from "../services/requirementVerification.js";
import { setAiGeneratorOverride, resetAiGeneratorOverride } from "../services/ai.js";

describe("Phase 3: Evidence-Based Requirement Verification Engine", () => {
  afterEach(() => {
    resetAiGeneratorOverride();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Mandatory requirement correctly implemented
  // --------------------------------------------------------------------------
  it("1. Mandatory requirement correctly implemented produces PASS with concrete evidence", async () => {
    const contract = createDefaultRequirementContract("Create a clean minimal portfolio website");
    const files = {
      "/App.js": `
        import React from 'react';
        import './styles.css';
        import Hero from './components/Hero.js';
        export default function App() {
          return (
            <main className="min-h-screen bg-white text-zinc-900 md:px-12">
              <Hero />
            </main>
          );
        }
      `,
      "/styles.css": "body { background: #ffffff; color: #18181b; }",
      "/components/Hero.js": `
        import React from 'react';
        export default function Hero() {
          return (
            <section className="py-20 md:py-32">
              <h1 className="text-4xl md:text-6xl font-bold">Creative Portfolio</h1>
              <p>Designing digital artifacts</p>
              <button className="rounded-full bg-zinc-900 text-white px-6 py-3">View Works</button>
            </section>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);

    assert.ok(report);
    assert.ok(report.totalRequirements > 0);
    const heroReq = report.requirements.find((r) => r.requirementId === "section_hero");
    assert.ok(heroReq, "Hero section requirement must be evaluated");
    assert.equal(heroReq.status, "PASS");
    assert.ok(heroReq.evidence.length > 0);
    assert.ok(heroReq.confidence >= 0.85);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Mandatory requirement completely missing
  // --------------------------------------------------------------------------
  it("2. Mandatory requirement completely missing produces FAIL with explanation", async () => {
    const contract = createDefaultRequirementContract("Create an online boutique store with shopping cart");
    // Project files completely lack cart drawer and cart functionality
    const files = {
      "/App.js": "export default function App() { return <div>Bare Shell</div>; }",
      "/styles.css": "body { color: black; }",
    };

    const report = await verifyProjectRequirements(files, contract, null);

    const cartFn = report.requirements.find((r) => r.requirementId.includes("cart"));
    assert.ok(cartFn);
    assert.equal(cartFn.status, "FAIL");
    assert.ok(cartFn.missingEvidence.length > 0);
    assert.equal(report.mandatoryFailed > 0, true);
    assert.equal(report.overallStatus, "FAILED");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Requirement with matching keyword but no real functionality
  // --------------------------------------------------------------------------
  it("3. Requirement with matching keyword but no real functionality fails or marks partial", async () => {
    const contract = createDefaultRequirementContract("Online boutique store with shopping cart");
    // Button contains text "Add to Bag", but no onClick handler, no useState, no cart array
    const files = {
      "/App.js": `
        import React from 'react';
        export default function App() {
          return (
            <div>
              <h2>Sneaker</h2>
              {/* Keyword present in comment and text, but ZERO real functionality */}
              <button>Add to Bag</button>
            </div>
          );
        }
      `,
      "/styles.css": "body { color: black; }",
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const cartFn = report.requirements.find((r) => r.requirementId === "fn_cart_management");

    assert.ok(cartFn);
    // Must NOT pass on keyword alone!
    assert.notEqual(cartFn.status, "PASS");
    assert.equal(cartFn.status, "FAIL");
    assert.ok(cartFn.explanation.includes("purely visual") || cartFn.explanation.includes("missing"));
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Search input without filtering behavior
  // --------------------------------------------------------------------------
  it("4. Search input without filtering behavior produces FAIL or PARTIAL, never PASS", async () => {
    const contract = createDefaultRequirementContract("SaaS directory with search filtering");
    // Input element exists with placeholder 'Search', but no value, no onChange, no .filter()
    const files = {
      "/App.js": `
        import React from 'react';
        export default function App() {
          return (
            <div>
              <input type="search" placeholder="Search articles..." />
              <ul>
                <li>Article 1</li>
                <li>Article 2</li>
              </ul>
            </div>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const searchReq = report.requirements.find((r) => r.requirementId.includes("search") || r.requirementId.includes("filter"));

    if (searchReq) {
      assert.notEqual(searchReq.status, "PASS", "Static search input without filtering must not PASS");
      assert.ok(searchReq.missingEvidence.some((e) => /filter|controlled|handler/i.test(e)));
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Search input connected to actual filtering behavior
  // --------------------------------------------------------------------------
  it("5. Search input connected to actual filtering behavior produces PASS", async () => {
    const contract = createDefaultRequirementContract("Product catalog with search filtering");
    contract.functionalRequirements = [
      {
        id: "catalog_search",
        name: "Catalog Search",
        description: "Search products by name dynamically",
        category: "search_filtering",
        expectedBehavior: "Typing filters rendered product cards in real time",
        priority: "mandatory",
      },
    ];

    const files = {
      "/App.js": `
        import React, { useState } from 'react';
        const ITEMS = [{ id: 1, name: 'Air Max' }, { id: 2, name: 'Dunk Low' }];
        export default function App() {
          const [search, setSearch] = useState("");
          const filtered = ITEMS.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
          return (
            <div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sneakers..."
              />
              <div className="grid">
                {filtered.map(item => <div key={item.id}>{item.name}</div>)}
              </div>
            </div>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const searchReq = report.requirements.find((r) => r.requirementId === "fn_catalog_search");

    assert.ok(searchReq);
    assert.equal(searchReq.status, "PASS");
    assert.ok(searchReq.evidence.some((e) => /controlled state/i.test(e)));
    assert.ok(searchReq.evidence.some((e) => /filter/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Form without submission handling
  // --------------------------------------------------------------------------
  it("6. Form without submission handling produces FAIL", async () => {
    const contract = createDefaultRequirementContract("Landing page with contact form");
    contract.functionalRequirements = [
      {
        id: "contact_form",
        name: "Contact Form",
        description: "Submit inquiry form",
        category: "forms_validation",
        expectedBehavior: "Submits message and displays confirmation",
        priority: "mandatory",
      },
    ];

    const files = {
      "/App.js": `
        import React from 'react';
        export default function App() {
          return (
            <form>
              <input type="text" placeholder="Name" />
              <input type="email" placeholder="Email" />
              <button type="submit">Submit</button>
            </form>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const formReq = report.requirements.find((r) => r.requirementId === "fn_contact_form");

    assert.ok(formReq);
    assert.equal(formReq.status, "FAIL");
    assert.ok(formReq.missingEvidence.some((e) => /submission handler|onSubmit/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Form with submission handling
  // --------------------------------------------------------------------------
  it("7. Form with submission handling and feedback produces PASS", async () => {
    const contract = createDefaultRequirementContract("Landing page with contact form");
    contract.functionalRequirements = [
      {
        id: "contact_form",
        name: "Contact Form",
        description: "Submit inquiry form",
        category: "forms_validation",
        expectedBehavior: "Submits message and displays confirmation",
        priority: "mandatory",
      },
    ];

    const files = {
      "/App.js": `
        import React, { useState } from 'react';
        export default function App() {
          const [name, setName] = useState("");
          const [submitted, setSubmitted] = useState(false);
          const handleSubmit = (e) => {
            e.preventDefault();
            setSubmitted(true);
          };
          return (
            <form onSubmit={handleSubmit}>
              <input value={name} onChange={e => setName(e.target.value)} />
              <button type="submit">Send</button>
              {submitted && <p className="text-green-500">Thank you! Your message was sent.</p>}
            </form>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const formReq = report.requirements.find((r) => r.requirementId === "fn_contact_form");

    assert.ok(formReq);
    assert.equal(formReq.status, "PASS");
    assert.ok(formReq.evidence.some((e) => /submission/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Navigation with missing destination
  // --------------------------------------------------------------------------
  it("8. Navigation with missing destination produces PARTIAL or FAIL", async () => {
    const contract = createDefaultRequirementContract("Multi-page SaaS portal");
    contract.functionalRequirements = [
      {
        id: "view_navigation",
        name: "View Navigation",
        description: "Switch views reactively",
        category: "navigation_routing",
        expectedBehavior: "Clicking nav tabs renders target view",
        priority: "mandatory",
      },
    ];

    // Navigation switches view to 'pricing', but App.js does NOT conditionally render pricing view!
    const files = {
      "/App.js": `
        import React, { useState } from 'react';
        export default function App() {
          const [view, setView] = useState("home");
          return (
            <nav>
              <button onClick={() => setView("pricing")}>Pricing</button>
              {/* Destination view is missing! */}
              <div>Always Home</div>
            </nav>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const navReq = report.requirements.find((r) => r.requirementId === "fn_view_navigation");

    assert.ok(navReq);
    assert.notEqual(navReq.status, "PASS");
    assert.equal(navReq.status, "PARTIAL");
    assert.ok(navReq.missingEvidence.some((e) => /destination view/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Responsive requirement with no responsive implementation
  // --------------------------------------------------------------------------
  it("9. Responsive requirement with no responsive implementation produces FAIL", async () => {
    const contract = createDefaultRequirementContract("SaaS landing page");
    // Code uses only fixed pixel classes with NO Tailwind responsive breakpoint prefixes (sm:, md:, lg:)
    const files = {
      "/App.js": `
        export default function App() {
          return <div className="w-[1200px] flex">Fixed Non-responsive Desktop Layout</div>;
        }
      `,
      "/styles.css": "body { width: 1200px; }",
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const respReq = report.requirements.find((r) => r.requirementId === "responsive_adaptation");

    assert.ok(respReq);
    assert.equal(respReq.status, "FAIL");
    assert.ok(respReq.missingEvidence.some((e) => /breakpoint/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Requirement partially implemented
  // --------------------------------------------------------------------------
  it("10. Requirement partially implemented produces PARTIAL status", async () => {
    const contract = createDefaultRequirementContract("SaaS landing page with FAQ accordion");
    // Code has tab state and click handler, but no conditional content display
    const files = {
      "/App.js": `
        import React, { useState } from 'react';
        export default function App() {
          const [openIndex, setOpenIndex] = useState(null);
          return (
            <div>
              <button onClick={() => setOpenIndex(0)}>Question 1</button>
              {/* Lacks conditional answer display based on openIndex */}
            </div>
          );
        }
      `,
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const faqReq = report.requirements.find(
      (r) => r.requirementType === "functional" && (r.requirementId.includes("faq") || r.requirementId.includes("accordion"))
    );

    assert.ok(faqReq, "Functional FAQ accordion requirement must be present");
    assert.equal(faqReq.status, "PARTIAL");
    assert.ok(faqReq.missingEvidence.length > 0);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Requirement that cannot be reliably verified statically
  // --------------------------------------------------------------------------
  it("11. Requirement that cannot be reliably verified statically produces UNVERIFIABLE", async () => {
    const contract = createDefaultRequirementContract("Warm organic restaurant website");
    contract.design.visualStyle = "Atmospheric warm candlelight glow with sensory culinary textures";

    const files = {
      "/App.js": "export default function App() { return <div className='bg-amber-50'>Restaurant</div>; }",
      "/styles.css": "body { background: #fffbeb; }",
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const subjectiveReq = report.requirements.find((r) => r.requirementId === "design_subjective_atmosphere");

    assert.ok(subjectiveReq);
    assert.equal(subjectiveReq.status, "UNVERIFIABLE");
    assert.equal(subjectiveReq.confidence, 0);
    assert.ok(subjectiveReq.missingEvidence.some((e) => /visual atmosphere/i.test(e)));
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Missing referenced FilePlan file
  // --------------------------------------------------------------------------
  it("12. Missing referenced FilePlan file produces FAIL with diagnostic", async () => {
    const contract = createDefaultRequirementContract("SaaS platform");
    const plan = {
      files: [
        { path: "/App.js", description: "Main entry", mandatory: true },
        { path: "/styles.css", description: "Styles", mandatory: true },
        { path: "/components/Dashboard.js", description: "Main telemetry dashboard", mandatory: true },
      ],
    };

    // Generated files are missing /components/Dashboard.js
    const files = {
      "/App.js": "export default function App() { return <div>App</div>; }",
      "/styles.css": "body { color: black; }",
    };

    const report = await verifyProjectRequirements(files, contract, plan);
    const missingFileReq = report.requirements.find((r) => r.requirementId.includes("Dashboard"));

    assert.ok(missingFileReq);
    assert.equal(missingFileReq.status, "FAIL");
    assert.ok(missingFileReq.missingEvidence.some((e) => e.includes("/components/Dashboard.js")));
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Requirement assigned to an unrelated file
  // --------------------------------------------------------------------------
  it("13. Requirement assigned to missing target file produces FAIL", async () => {
    const contract = createDefaultRequirementContract("E-commerce storefront");
    contract.functionalRequirements = [
      {
        id: "cart_drawer",
        name: "Cart Drawer",
        category: "ecommerce_cart",
        implementationTarget: "/components/MissingCartDrawer.js",
        priority: "mandatory",
      },
    ];

    const files = {
      "/App.js": "export default function App() { return <div>App</div>; }",
      "/styles.css": "body { color: black; }",
    };

    const report = await verifyProjectRequirements(files, contract, null);
    const targetReq = report.requirements.find(
      (r) => r.requirementId.includes("consistency_target_missing") || r.affectedFiles.includes("/components/MissingCartDrawer.js")
    );

    assert.ok(targetReq, "Missing target requirement must be flagged");
    assert.equal(targetReq.status, "FAIL");
    assert.ok(targetReq.explanation.includes("does not exist"));
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Empty or malformed Requirement Contract
  // --------------------------------------------------------------------------
  it("14. Empty or malformed Requirement Contract is handled safely without crash", async () => {
    const files = { "/App.js": "export default function App() { return <div>App</div>; }" };

    const report = await verifyProjectRequirements(files, null, null);

    assert.ok(report);
    assert.equal(report.overallStatus, "UNVERIFIABLE");
    assert.equal(report.mandatoryUnverifiable, 1);
    assert.ok(report.verificationWarnings.some((w) => /missing or malformed/i.test(w)));
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Empty generated file collection
  // --------------------------------------------------------------------------
  it("15. Empty generated file collection produces FAILED overallStatus without crash", async () => {
    const contract = createDefaultRequirementContract("SaaS landing page");

    const report = await verifyProjectRequirements({}, contract, null);

    assert.ok(report);
    assert.equal(report.overallStatus, "FAILED");
    assert.equal(report.failed, 1);
    assert.ok(report.verificationWarnings.some((w) => /empty/i.test(w)));
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Invalid AI verification response handling
  // --------------------------------------------------------------------------
  it("16. Invalid AI verification response is safely handled and does not crash", async () => {
    // Mock generateStructuredObject to throw malformed response error
    setAiGeneratorOverride(() => {
      throw new Error("Invalid AI schema response format");
    });

    const unresolved = [
      {
        requirementId: "req_unresolved_test",
        requirementText: "Ambiguous micro-interaction",
        status: "UNVERIFIABLE",
      },
    ];

    const aiResults = await verifyWithAiFallback(unresolved, { "/App.js": "export default function App() {}" }, "test");

    assert.deepEqual(aiResults, []);
  });

  // --------------------------------------------------------------------------
  // Scenario 17: Gemini / OpenRouter provider verification parity
  // --------------------------------------------------------------------------
  it("17. AI fallback works with mock provider conforming to AiVerificationBatchSchema", async () => {
    setAiGeneratorOverride(({ schema }) => {
      return {
        object: {
          evaluations: [
            {
              requirementId: "req_ai_test",
              status: "PASS",
              confidence: 0.85,
              evidence: ["Concrete code pattern found in /App.js line 12"],
              missingEvidence: [],
              explanation: "AI identified working implementation pattern",
              recommendedAction: "None",
            },
          ],
        },
      };
    });

    const unresolved = [
      {
        requirementId: "req_ai_test",
        requirementText: "Subtle kinetic micro-reveal",
        status: "UNVERIFIABLE",
      },
    ];

    const aiResults = await verifyWithAiFallback(unresolved, { "/App.js": "const code = 1;" }, "test");

    assert.equal(aiResults.length, 1);
    assert.equal(aiResults[0].status, "PASS");
    assert.equal(aiResults[0].requirementId, "req_ai_test");
  });

  // --------------------------------------------------------------------------
  // Scenario 18: Revision verification behavior
  // --------------------------------------------------------------------------
  it("18. Revision verification evaluates updated contract and candidate files", async () => {
    const initialContract = createDefaultRequirementContract("Portfolio with dark theme");
    const updatedContract = createDefaultRequirementContract("Portfolio with light theme and FAQ accordion");

    const revisedFiles = {
      "/App.js": `
        import React, { useState } from 'react';
        export default function App() {
          const [openFaq, setOpenFaq] = useState(null);
          return (
            <div className="bg-white text-zinc-900 md:p-8">
              <button onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}>FAQ Question</button>
              {openFaq === 0 && <p>Answer text</p>}
            </div>
          );
        }
      `,
      "/styles.css": "body { background: #ffffff; }",
    };

    const report = await verifyProjectRequirements(revisedFiles, updatedContract, null);

    assert.ok(report);
    const themeReq = report.requirements.find((r) => r.requirementId === "design_color_theme");
    assert.equal(themeReq.status, "PASS");
  });

  // --------------------------------------------------------------------------
  // Scenario 19: Parser / compiler unavailable
  // --------------------------------------------------------------------------
  it("19. Handles unavailable parser gracefully without throwing uncaught exceptions", async () => {
    const contract = createDefaultRequirementContract("SaaS landing page");
    const files = {
      "/App.js": "export default function App() { return <div>Shell</div>; }",
    };

    // Simulate parser unavailable option
    const report = await verifyProjectRequirements(files, contract, null, {
      parserAvailable: false,
    });

    assert.ok(report);
    assert.ok(report.totalRequirements > 0);
  });

  // --------------------------------------------------------------------------
  // Scenario 20: Infrastructure failure must not produce PASS
  // --------------------------------------------------------------------------
  it("20. Infrastructure failure must not produce PASS or VERIFIED status", async () => {
    const contract = createDefaultRequirementContract("SaaS landing page");
    const files = {
      "/App.js": "invalid syntax {{{",
    };

    // Simulate complete compiler infrastructure crash
    const report = await verifyProjectRequirements(files, contract, null, {
      parserAvailable: false,
      failOnInfrastructure: true,
    });

    assert.ok(report);
    assert.notEqual(report.overallStatus, "VERIFIED", "Infrastructure failure must NEVER produce VERIFIED");
    assert.equal(report.overallStatus, "UNVERIFIABLE");
  });

  // --------------------------------------------------------------------------
  // Targeted Hardening Regression Tests
  // --------------------------------------------------------------------------
  describe("Targeted Verification Hardening Regressions", () => {
    // 1. Search state and unrelated .filter() must not PASS
    it("H1. Search state and unrelated .filter() must not PASS", async () => {
      const contract = createDefaultRequirementContract("Product catalog with search");
      contract.functionalRequirements = [
        {
          id: "catalog_search",
          name: "Catalog Search",
          category: "search_filtering",
          expectedBehavior: "Typing filters rendered product cards",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          const items = [{ id: 1, active: true }, { id: 2, active: false }];
          export default function App() {
            const [query, setQuery] = useState("");
            // Unrelated filter: filters by item.active, does NOT reference query!
            const filtered = items.filter(item => item.active);
            return (
              <div>
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {filtered.map(item => <div key={item.id}>{item.id}</div>)}
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const searchReq = report.requirements.find((r) => r.requirementId === "fn_catalog_search");

      assert.ok(searchReq);
      assert.notEqual(searchReq.status, "PASS", "Unrelated .filter() must never PASS search requirement");
      assert.equal(searchReq.status, "PARTIAL");
      assert.ok(searchReq.missingEvidence.some((e) => /search query/i.test(e)));
    });

    // 2. Search query correctly connected to filtering can PASS
    it("H2. Search query correctly connected to filtering can PASS", async () => {
      const contract = createDefaultRequirementContract("Product catalog with search");
      contract.functionalRequirements = [
        {
          id: "catalog_search",
          name: "Catalog Search",
          category: "search_filtering",
          expectedBehavior: "Typing filters rendered product cards",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          const items = [{ id: 1, name: 'Apple' }, { id: 2, name: 'Banana' }];
          export default function App() {
            const [searchTerm, setSearchTerm] = useState("");
            const filtered = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
            return (
              <div>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search fruits..."
                />
                {filtered.map(item => <div key={item.id}>{item.name}</div>)}
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const searchReq = report.requirements.find((r) => r.requirementId === "fn_catalog_search");

      assert.ok(searchReq);
      assert.equal(searchReq.status, "PASS");
      assert.ok(searchReq.evidence.some((e) => /actively filtering data/i.test(e)));
    });

    // 3. Empty form submission handler must not PASS
    it("H3. Empty form submission handler must not PASS", async () => {
      const contract = createDefaultRequirementContract("Contact form page");
      contract.functionalRequirements = [
        {
          id: "contact_form",
          name: "Contact Form",
          category: "forms_validation",
          expectedBehavior: "Submits contact info and shows feedback",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React from 'react';
          export default function App() {
            return (
              <form onSubmit={e => e.preventDefault()}>
                <input name="email" />
                <button type="submit">Submit</button>
              </form>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const formReq = report.requirements.find((r) => r.requirementId === "fn_contact_form");

      assert.ok(formReq);
      assert.notEqual(formReq.status, "PASS", "Empty preventDefault handler must never PASS");
      assert.equal(formReq.status, "PARTIAL");
      assert.ok(formReq.missingEvidence.some((e) => /Meaningful submission logic/i.test(e)));
    });

    // 4. Form handler with meaningful submission behavior can PASS
    it("H4. Form handler with meaningful submission behavior and feedback can PASS", async () => {
      const contract = createDefaultRequirementContract("Contact form page");
      contract.functionalRequirements = [
        {
          id: "contact_form",
          name: "Contact Form",
          category: "forms_validation",
          expectedBehavior: "Submits contact info and shows feedback",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          export default function App() {
            const [email, setEmail] = useState("");
            const [submitted, setSubmitted] = useState(false);
            const handleSubmit = (e) => {
              e.preventDefault();
              setSubmitted(true);
            };
            return (
              <div>
                <form onSubmit={handleSubmit}>
                  <input value={email} onChange={e => setEmail(e.target.value)} />
                  <button type="submit">Submit</button>
                </form>
                {submitted && <p>Your message has been sent!</p>}
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const formReq = report.requirements.find((r) => r.requirementId === "fn_contact_form");

      assert.ok(formReq);
      assert.equal(formReq.status, "PASS");
      assert.ok(formReq.evidence.some((e) => /meaningful state mutation/i.test(e)));
    });

    // 5. Static status text cannot satisfy form feedback
    it("H5. Static status text cannot satisfy form feedback", async () => {
      const contract = createDefaultRequirementContract("Contact form page");
      contract.functionalRequirements = [
        {
          id: "contact_form",
          name: "Contact Form",
          category: "forms_validation",
          expectedBehavior: "Submits contact info and shows feedback",
          priority: "mandatory",
        },
      ];

      // Form has e.preventDefault() and unrelated static text with the word 'status'
      const files = {
        "/App.js": `
          import React from 'react';
          export default function App() {
            return (
              <form onSubmit={e => e.preventDefault()}>
                <input name="email" />
                <p>System status: operational</p>
                <button type="submit">Submit</button>
              </form>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const formReq = report.requirements.find((r) => r.requirementId === "fn_contact_form");

      assert.ok(formReq);
      assert.notEqual(formReq.status, "PASS", "Static status text must never satisfy form feedback");
      assert.equal(formReq.status, "PARTIAL");
    });

    // 6. Unrelated .reduce() cannot satisfy cart totals
    it("H6. Unrelated .reduce() cannot satisfy cart totals", async () => {
      const contract = createDefaultRequirementContract("Store with cart");
      contract.functionalRequirements = [
        {
          id: "cart_management",
          name: "Cart Management",
          category: "ecommerce_cart",
          expectedBehavior: "Manages items and calculates total price",
          priority: "mandatory",
        },
      ];

      // Cart exists, but .reduce() is on ratings, not cart items!
      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          export default function App() {
            const [cart, setCart] = useState([]);
            const ratings = [5, 4, 5, 5];
            const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
            return (
              <div>
                <button onClick={() => setCart([...cart, { id: 1 }])}>Add to Cart</button>
                <div className="cart-drawer">
                  {cart.map(item => <div key={item.id}>Item {item.id}</div>)}
                </div>
                <div>Average Rating: {avgRating}</div>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const cartReq = report.requirements.find((r) => r.requirementId === "fn_cart_management");

      assert.ok(cartReq);
      assert.notEqual(cartReq.status, "PASS", "Unrelated ratings reduction must not satisfy cart total");
      assert.equal(cartReq.status, "PARTIAL");
      assert.ok(cartReq.missingEvidence.some((e) => /Price subtotal\/total calculation/i.test(e)));
    });

    // 7. Cart-state-based price reduction can PASS
    it("H7. Cart-state-based price reduction can PASS", async () => {
      const contract = createDefaultRequirementContract("Store with cart");
      contract.functionalRequirements = [
        {
          id: "cart_management",
          name: "Cart Management",
          category: "ecommerce_cart",
          expectedBehavior: "Manages items and calculates total price",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          export default function App() {
            const [cart, setCart] = useState([{ id: 1, price: 50, quantity: 2 }]);
            const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return (
              <div>
                <button onClick={() => setCart([...cart, { id: 2, price: 30, quantity: 1 }])}>Add to Cart</button>
                <div className="cart-drawer">
                  {cart.map(item => <div key={item.id}>Item {item.id}: {item.price}</div>)}
                  <div>Total: {totalPrice}</div>
                </div>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const cartReq = report.requirements.find((r) => r.requirementId === "fn_cart_management");

      assert.ok(cartReq);
      assert.equal(cartReq.status, "PASS");
      assert.ok(cartReq.evidence.some((e) => /Price computation/i.test(e)));
    });

    // 8. Dictionary-based navigation is recognized
    it("H8. Dictionary-based navigation is recognized and can PASS", async () => {
      const contract = createDefaultRequirementContract("Multi-view application");
      contract.functionalRequirements = [
        {
          id: "view_navigation",
          name: "View Navigation",
          category: "navigation_routing",
          expectedBehavior: "Switches active tabs via view dictionary",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          const TABS = {
            overview: <div>Overview Content</div>,
            specs: <div>Technical Specifications</div>
          };
          export default function App() {
            const [activeTab, setActiveTab] = useState("overview");
            return (
              <div>
                <nav>
                  <button onClick={() => setActiveTab("overview")}>Overview</button>
                  <button onClick={() => setActiveTab("specs")}>Specs</button>
                </nav>
                <main>{TABS[activeTab]}</main>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const navReq = report.requirements.find((r) => r.requirementId === "fn_view_navigation");

      assert.ok(navReq);
      assert.equal(navReq.status, "PASS");
      assert.ok(navReq.evidence.some((e) => /Destination view dynamically rendered/i.test(e)));
    });

    // 9. Switch-based navigation is recognized
    it("H9. Switch-based navigation is recognized and can PASS", async () => {
      const contract = createDefaultRequirementContract("Multi-view application");
      contract.functionalRequirements = [
        {
          id: "view_navigation",
          name: "View Navigation",
          category: "navigation_routing",
          expectedBehavior: "Switches active view via switch statement",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useState } from 'react';
          export default function App() {
            const [view, setView] = useState("home");
            const renderContent = () => {
              switch (view) {
                case "home":
                  return <div>Home View</div>;
                case "about":
                  return <div>About View</div>;
                default:
                  return <div>404</div>;
              }
            };
            return (
              <div>
                <nav>
                  <button onClick={() => setView("home")}>Home</button>
                  <button onClick={() => setView("about")}>About</button>
                </nav>
                <main>{renderContent()}</main>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const navReq = report.requirements.find((r) => r.requirementId === "fn_view_navigation");

      assert.ok(navReq);
      assert.equal(navReq.status, "PASS");
    });

    // 10. useReducer state management is recognized where supported
    it("H10. useReducer state management is recognized for functional state", async () => {
      const contract = createDefaultRequirementContract("Counter application");
      contract.functionalRequirements = [
        {
          id: "counter_controls",
          name: "Counter Controls",
          category: "interactive_controls",
          expectedBehavior: "Updates counter state via dispatch",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": `
          import React, { useReducer } from 'react';
          function reducer(state, action) {
            switch (action.type) {
              case 'inc': return { count: state.count + 1 };
              default: return state;
            }
          }
          export default function App() {
            const [state, dispatch] = useReducer(reducer, { count: 0 });
            return (
              <div>
                <p>Count: {state.count}</p>
                <button onClick={() => dispatch({ type: 'inc' })}>Increment</button>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const counterReq = report.requirements.find((r) => r.requirementId === "fn_counter_controls");

      assert.ok(counterReq);
      assert.equal(counterReq.status, "PASS");
    });

    // 11. Custom hook behavior is evaluated when source is available
    it("H11. Custom hook behavior is evaluated when source is available", async () => {
      const contract = createDefaultRequirementContract("Store with custom hook cart");
      contract.functionalRequirements = [
        {
          id: "cart_hook",
          name: "Cart Hook",
          category: "ecommerce_cart",
          expectedBehavior: "Uses useCart custom hook backed by state",
          priority: "mandatory",
        },
      ];

      const files = {
        "/hooks/useCart.js": `
          import { useState } from 'react';
          export function useCart() {
            const [cart, setCart] = useState([]);
            const addToCart = (item) => setCart([...cart, item]);
            return { cart, addToCart };
          }
        `,
        "/App.js": `
          import React from 'react';
          import { useCart } from './hooks/useCart.js';
          export default function App() {
            const { cart, addToCart } = useCart();
            const total = cart.reduce((sum, item) => sum + (item.price || 10), 0);
            return (
              <div>
                <button onClick={() => addToCart({ id: 1, price: 20 })}>Add to Cart</button>
                <div className="cart-drawer">
                  {cart.map(i => <div key={i.id}>{i.price}</div>)}
                  <p>Total: {total}</p>
                </div>
              </div>
            );
          }
        `,
      };

      const report = await verifyProjectRequirements(files, contract, null);
      const cartReq = report.requirements.find((r) => r.requirementId === "fn_cart_hook");

      assert.ok(cartReq);
      assert.equal(cartReq.status, "PASS");
    });

    // 12. Parser fallback produces UNVERIFIABLE instead of misleading FAIL
    it("H12. Parser fallback produces UNVERIFIABLE instead of misleading FAIL", async () => {
      const contract = createDefaultRequirementContract("Search dashboard");
      contract.functionalRequirements = [
        {
          id: "search_feature",
          name: "Search Feature",
          category: "search_filtering",
          expectedBehavior: "Interactive search",
          implementationTarget: "/components/SearchBox.js",
          priority: "mandatory",
        },
      ];

      const files = {
        "/App.js": "export default function App() { return <div>App</div>; }",
        "/components/SearchBox.js": "export default function SearchBox() { return <div>Complex</div>; }",
      };

      // Mock buildProjectAnalysisMap to simulate parser fallback on /components/SearchBox.js
      const analysisMap = await buildProjectAnalysisMap(files);
      analysisMap["/components/SearchBox.js"].astFallback = true;
      analysisMap["/components/SearchBox.js"].jsxElements = [];
      analysisMap["/components/SearchBox.js"].stateHooks = [];

      const { verifyFunctionalEvidence } = await import("../services/requirementVerification.js");
      const items = verifyFunctionalEvidence(contract, files, analysisMap);
      const searchItem = items.find((i) => i.requirementId === "fn_search_feature");

      assert.ok(searchItem);
      assert.equal(searchItem.status, "UNVERIFIABLE", "Parser fallback must yield UNVERIFIABLE, not FAIL");
      assert.equal(searchItem.source, "static_analysis_unverifiable");
      assert.ok(searchItem.explanation.includes("parser fallback"));
    });
  });
});
