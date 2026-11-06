import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.VISUAL_VERIFICATION_TIMEOUT_MS = "50";

import {
  generateProject,
  setAiGeneratorOverride,
  resetAiGeneratorOverride,
} from "../services/ai.js";
import {
  RequirementContractSchema,
  DesignSpecSchema,
  FilePlanSchema,
  FileCodeSchema,
} from "../services/aiSchemas.js";
import { createProject } from "../controllers/projectController.js";
import { Project } from "../models/Project.js";
import { runEvidenceDrivenSelfRepairLoop } from "../services/selfRepair.js";

describe("Phase 5 Stage 3: Initial Website Generation Pipeline Integration Suite", () => {
  afterEach(() => {
    resetAiGeneratorOverride();
  });

  // --------------------------------------------------------------------------
  // Reusable Deterministic Fixture 1: Modern Portfolio Storefront
  // --------------------------------------------------------------------------
  const portfolioFiles = {
    "/package.json": JSON.stringify(
      {
        name: "builder-ai-portfolio",
        version: "1.0.0",
        private: true,
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "lucide-react": "^0.300.0",
        },
      },
      null,
      2
    ),
    "/styles.css": `
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
      :root {
        --primary: #09090b;
        --background: #ffffff;
        --foreground: #09090b;
      }
      body {
        margin: 0;
        font-family: Inter, sans-serif;
        background-color: var(--background);
        color: var(--foreground);
        overflow-x: hidden;
      }
    `,
    "/App.js": `
      import React from 'react';
      import Navbar from './components/Navbar';
      import Hero from './components/Hero';
      import Projects from './components/Projects';
      import Skills from './components/Skills';
      import Contact from './components/Contact';
      import './styles.css';

      export default function App() {
        return (
          <div className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">
            <Navbar />
            <main>
              <Hero />
              <Projects />
              <Skills />
              <Contact />
            </main>
          </div>
        );
      }
    `,
    "/components/Navbar.js": `
      import React, { useState } from 'react';

      export default function Navbar() {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <header className="sticky top-0 bg-white/90 backdrop-blur border-b border-zinc-200 z-50">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <span className="font-bold text-xl text-zinc-900">Modern Portfolio</span>
              <nav className="hidden md:flex space-x-6">
                <a href="#projects" className="text-zinc-600 hover:text-zinc-900 transition">Projects</a>
                <a href="#skills" className="text-zinc-600 hover:text-zinc-900 transition">Skills</a>
                <a href="#contact" className="text-zinc-600 hover:text-zinc-900 transition">Contact</a>
              </nav>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded text-zinc-700"
                aria-label="Toggle navigation menu"
              >
                Menu
              </button>
            </div>
            {isOpen && (
              <div className="md:hidden px-4 pt-2 pb-4 space-y-2 border-t border-zinc-100 bg-white">
                <a href="#projects" className="block text-zinc-600 hover:text-zinc-900">Projects</a>
                <a href="#skills" className="block text-zinc-600 hover:text-zinc-900">Skills</a>
                <a href="#contact" className="block text-zinc-600 hover:text-zinc-900">Contact</a>
              </div>
            )}
          </header>
        );
      }
    `,
    "/components/Hero.js": `
      import React from 'react';

      export default function Hero() {
        return (
          <section className="py-20 md:py-32 px-4 max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 mb-6">
              Crafting Digital Experiences That Inspire
            </h1>
            <p className="text-lg md:text-xl text-zinc-600 max-w-2xl mx-auto mb-8">
              Senior Frontend Engineer & Product Designer specializing in React, Next.js, and modern interface architecture.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#projects" className="px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition">
                View Work
              </a>
              <a href="#contact" className="px-6 py-3 border border-zinc-300 text-zinc-800 font-medium rounded-lg hover:bg-zinc-50 transition">
                Contact Me
              </a>
            </div>
          </section>
        );
      }
    `,
    "/components/Projects.js": `
      import React from 'react';

      const SAMPLE_PROJECTS = [
        { id: 1, title: 'E-Commerce Storefront', category: 'Web App', desc: 'Scalable headless commerce frontend' },
        { id: 2, title: 'AI Workspace Canvas', category: 'SaaS', desc: 'Real-time collaborative diagramming' },
        { id: 3, title: 'Design System Primitives', category: 'UI Kit', desc: 'Accessible React component library' },
      ];

      export default function Projects() {
        return (
          <section id="projects" className="py-16 md:py-24 px-4 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-900 mb-8 text-center md:text-left">Selected Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {SAMPLE_PROJECTS.map((project) => (
                <div key={project.id} className="p-6 border border-zinc-200 rounded-xl hover:shadow-lg transition bg-white">
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{project.category}</span>
                  <h3 className="text-xl font-bold text-zinc-900 mt-2 mb-2">{project.title}</h3>
                  <p className="text-zinc-600 text-sm">{project.desc}</p>
                </div>
              ))}
            </div>
          </section>
        );
      }
    `,
    "/components/Skills.js": `
      import React from 'react';

      const SKILLS = ['React 19', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Node.js', 'GraphQL', 'Architecture', 'UI/UX Design'];

      export default function Skills() {
        return (
          <section id="skills" className="py-16 px-4 max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-900 mb-8 text-center">Core Expertise</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {SKILLS.map((skill) => (
                <span key={skill} className="px-4 py-2 bg-zinc-100 text-zinc-800 rounded-full font-medium text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        );
      }
    `,
    "/components/Contact.js": `
      import React, { useState } from 'react';

      export default function Contact() {
        const [submitted, setSubmitted] = useState(false);
        const [form, setForm] = useState({ name: '', email: '', message: '' });

        const handleSubmit = (e) => {
          e.preventDefault();
          setSubmitted(true);
        };

        return (
          <section id="contact" className="py-16 md:py-24 px-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-900 mb-6 text-center">Get in Touch</h2>
            {submitted ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-emerald-800">
                <p className="font-semibold">Message sent successfully!</p>
                <p className="text-sm mt-1">Thank you for reaching out. I will respond within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                    placeholder="How can I help with your next project?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition"
                >
                  Send Inquiry
                </button>
              </form>
            )}
          </section>
        );
      }
    `,
  };

  const sampleContract = {
    identity: {
      name: "Modern Portfolio",
      category: "agency_portfolio",
      purpose: "Showcase creative portfolio works, skills, and client inquiry form",
      targetAudience: "Prospective clients and engineering leaders",
      intendedUserExperience: "Clean, responsive, fast-loading professional showcase",
      mainConversionAction: "Send inquiry via contact form",
    },
    navigation: {
      type: "sticky_header",
      primaryItems: ["Projects", "Skills", "Contact"],
      secondaryItems: [],
      callToAction: "Contact",
      importantRoutes: ["/"],
      views: ["home"],
    },
    pages: [
      {
        id: "home",
        name: "Home",
        isPrimary: true,
        sections: [
          { id: "hero", name: "Hero", priority: "mandatory" },
          { id: "projects", name: "Projects", priority: "mandatory" },
          { id: "skills", name: "Skills", priority: "optional" },
          { id: "contact", name: "Contact", priority: "mandatory" },
        ],
      },
    ],
    functionalRequirements: [
      {
        id: "section_hero",
        name: "Hero Section",
        priority: "mandatory",
        description: "Hero with prominent headline and call to action",
        category: "interactive_controls",
        expectedBehavior: "Displays headline and CTA button",
        implementationTarget: "/components/Hero.js",
      },
      {
        id: "section_projects",
        name: "Projects Showcase Grid",
        priority: "mandatory",
        description: "Grid showcasing recent works",
        category: "data_display_state",
        expectedBehavior: "Renders responsive grid of project items",
        implementationTarget: "/components/Projects.js",
      },
      {
        id: "section_contact",
        name: "Contact Inquiry Form",
        priority: "mandatory",
        description: "Form with input fields and submit feedback",
        category: "forms_validation",
        expectedBehavior: "Validates inputs and displays confirmation message on submit",
        implementationTarget: "/components/Contact.js",
      },
    ],
    mandatoryRequirements: [
      "Hero section with creative title and call to action",
      "Projects showcase grid",
      "Contact inquiry form with message submission",
    ],
    optionalEnhancements: ["Skills expertise badges"],
    inferredRequirements: [],
    design: {
      visualStyle: "",
      colorPreferences: {
        theme: "light",
        primaryAccent: "#09090b",
        explicitPalette: [],
        notes: "",
        origin: "inferred",
      },
      typographyDirection: {
        headingStyle: "Modern sans-serif",
        bodyStyle: "Legible clean sans-serif",
        preferredFonts: ["Inter"],
        origin: "inferred",
      },
      layoutPreferences: {
        density: "comfortable",
        containerWidth: "max-w-7xl",
        gridStyle: "Responsive multi-column grid",
        origin: "inferred",
      },
      componentStyling: {
        cardRadius: "rounded-xl",
        buttonRadius: "rounded-lg",
        shadows: "Subtle elevations with smooth hover transition",
        origin: "inferred",
      },
      spacingAndHierarchy: "Generous whitespace with clear visual priority",
      imageAndIllustration: "Topic-relevant photography and vector icons",
      animationAndMotion: "Smooth hover micro-interactions",
      explicitDesignRequirements: [],
      inferredDesignDecisions: [],
    },
    responsive: {
      desktop: "Full multi-column layout with expanded navigation",
      tablet: "Adaptive 2-column layout with condensed controls",
      mobile: "Single column stacked layout with touch-friendly targets and simplified navigation",
      importantAdaptations: [],
    },
    content: {
      requiredCopy: [],
      toneOfVoice: "Professional, clear, engaging",
      imageryRequirements: [],
      iconRequirements: ["lucide-react inline icons"],
      placeholderRestrictions: "Avoid generic lorem ipsum",
      userProvidedAssets: [],
    },
  };

  const sampleDesignSpec = {
    archetype: "clean_modern",
    visualDirection: "Editorial Modernism",
    colorPalette: {
      theme: "light",
      bg: "#ffffff",
      fg: "#09090b",
      muted: "#71717a",
      line: "#e4e4e7",
      accent: "#09090b",
      accentForeground: "#ffffff",
      cardBg: "#ffffff",
      cardBorder: "#e4e4e7",
    },
    typography: {
      heading: { family: "Inter", weights: ["600", "700"], usage: "Headings" },
      body: { family: "Inter", weights: ["400", "500"], usage: "Body text" },
      fontImportUrl: "",
    },
    layoutGuidelines: "Clean, spacious grid layout with ample whitespace",
    componentStyling: "Minimal borders, subtle shadows, rounded-lg buttons",
    visualElements: "Generous padding, high contrast typography",
  };

  const sampleFilePlan = {
    projectName: "Modern Portfolio",
    projectDescription: "Portfolio showcase with hero, projects, and contact form",
    manifest: Object.keys(portfolioFiles),
    files: [
      { path: "/styles.css", description: "Global styles", exports: "none", imports: [] },
      { path: "/App.js", description: "Main home application root", exportName: "default", exports: "default App", imports: ["./components/Navbar", "./components/Hero", "./components/Projects", "./components/Skills", "./components/Contact"] },
      { path: "/components/Navbar.js", description: "Responsive navbar", exports: "default Navbar", imports: [] },
      { path: "/components/Hero.js", description: "Hero section", exports: "default Hero", imports: [] },
      { path: "/components/Projects.js", description: "Projects showcase", exports: "default Projects", imports: [] },
      { path: "/components/Skills.js", description: "Skills badges", exports: "default Skills", imports: [] },
      { path: "/components/Contact.js", description: "Contact form", exports: "default Contact", imports: [] },
    ],
  };

  // --------------------------------------------------------------------------
  // Test A: Successful Initial Generation Journey
  // --------------------------------------------------------------------------
  it("Test A: Successful initial generation journey executes callbacks in strict sequence and verifies all requirements", async () => {
    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) {
        return { object: sampleContract };
      }
      if (schema === DesignSpecSchema) {
        return { object: sampleDesignSpec };
      }
      if (schema === FilePlanSchema) {
        return { object: sampleFilePlan };
      }
      if (schema === FileCodeSchema) {
        for (const [filePath, code] of Object.entries(portfolioFiles)) {
          if (prompt.includes(filePath)) {
            return { object: { code } };
          }
        }
        return { object: { code: portfolioFiles["/App.js"] } };
      }
      throw new Error(`Unexpected schema requested in Test A: ${schema}`);
    });

    const callbackLog = [];
    const callbacks = {
      onRequirementContract: async (contract) => {
        callbackLog.push({ step: "contract", data: contract.identity?.name });
      },
      onDesignSpec: async (spec) => {
        callbackLog.push({ step: "designSpec", data: spec.archetype });
      },
      onPlan: async (plan) => {
        callbackLog.push({ step: "plan", count: plan.files.length });
      },
      onFileStart: async (path) => {
        callbackLog.push({ step: "fileStart", path });
      },
      onFileComplete: async (path, code) => {
        callbackLog.push({ step: "fileComplete", path, length: code.length });
      },
      onValidationStart: async () => {
        callbackLog.push({ step: "validating" });
      },
      onRequirementVerification: async (verification) => {
        callbackLog.push({
          step: "requirementVerification",
          status: verification.overallStatus,
          mandatoryFailed: verification.mandatoryFailed,
        });
      },
    };

    const prompt = "Build a modern portfolio for a senior designer with hero, projects, and contact form";
    const result = await generateProject(prompt, callbacks);

    // 1. Verify callback lifecycle sequence
    const stepNames = callbackLog.map((c) => c.step);
    assert.strictEqual(stepNames[0], "contract", "Step 0 must be onRequirementContract");
    assert.strictEqual(stepNames[1], "designSpec", "Step 1 must be onDesignSpec");
    assert.strictEqual(stepNames[2], "plan", "Step 2 must be onPlan");
    assert.ok(stepNames.includes("validating"), "Must execute onValidationStart");
    assert.ok(stepNames.includes("requirementVerification"), "Must execute onRequirementVerification");

    // 2. Verify files generated
    assert.ok(result.files["/styles.css"], "Must contain /styles.css");
    assert.ok(result.files["/App.js"], "Must contain /App.js");
    assert.ok(result.files["/components/Hero.js"], "Must contain /components/Hero.js");
    assert.ok(result.files["/components/Projects.js"], "Must contain /components/Projects.js");
    assert.ok(result.files["/components/Contact.js"], "Must contain /components/Contact.js");

    // 3. Verify contract and verification integrity
    assert.strictEqual(result.requirementContract.identity.name, "Modern Portfolio");
    assert.strictEqual(result.designSpec.archetype, "clean_modern");
    assert.ok(result.requirementVerification, "Must produce requirementVerification summary");
    assert.strictEqual(result.requirementVerification.mandatoryFailed, 0, "All mandatory requirements must pass");
    assert.strictEqual(result.requirementVerification.overallStatus, "VERIFIED", "Overall status must be VERIFIED");
    assert.strictEqual(result.featureReport.allMandatoryPassed, true, "Feature report must pass all mandatory items");
  });

  // --------------------------------------------------------------------------
  // Test B: Clean Generation Zero-Repair Bypass
  // --------------------------------------------------------------------------
  it("Test B: Clean generation zero-repair bypass avoids any secondary repair invocations when requirements pass", async () => {
    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) return { object: sampleFilePlan };
      if (schema === FileCodeSchema) {
        for (const [filePath, code] of Object.entries(portfolioFiles)) {
          if (prompt.includes(filePath)) return { object: { code } };
        }
        return { object: { code: portfolioFiles["/App.js"] } };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    const repairEvents = [];
    const callbacks = {
      onRepairStarted: async (data) => repairEvents.push({ event: "repair_started", data }),
      onRepairPlanCreated: async (data) => repairEvents.push({ event: "repair_plan_created", data }),
      onRepairAttemptStarted: async (data) => repairEvents.push({ event: "repair_attempt_started", data }),
      onRepairCompleted: async (data) => repairEvents.push({ event: "repair_completed", data }),
    };

    const result = await generateProject("Build a clean portfolio", callbacks);

    // Verify self-repair loop was completely bypassed
    assert.strictEqual(result.selfRepair, null, "SelfRepair report must remain null when zero mandatory failures occur");
    assert.strictEqual(repairEvents.length, 0, "Zero self-repair callbacks must fire on clean generation");
    assert.strictEqual(result.requirementVerification.mandatoryFailed, 0);
  });

  // --------------------------------------------------------------------------
  // Test C: Self-Repair Success (Mandatory Failure Repaired & Accepted)
  // --------------------------------------------------------------------------
  it("Test C: Self-repair loop triggers on mandatory requirement failure, generates targeted candidate, and accepts it", async () => {
    const brokenContactCode = `
      import React from 'react';
      export default function Contact() {
        return (
          <section id="contact" className="py-16 text-center">
            <h2>Contact Us</h2>
            <p>Work in progress - contact details coming soon.</p>
          </section>
        );
      }
    `;

    const repairedContactCode = `
      import React, { useState } from 'react';
      export default function Contact() {
        const [submitted, setSubmitted] = useState(false);
        const [form, setForm] = useState({ name: '', email: '', message: '' });
        const handleSubmit = (e) => {
          e.preventDefault();
          setSubmitted(true);
        };
        return (
          <section id="contact" className="py-16 px-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Get in Touch</h2>
            {submitted ? (
              <p className="text-emerald-700 font-semibold">Message sent successfully!</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <input
                  type="email"
                  required
                  placeholder="Your Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <textarea
                  required
                  placeholder="Your Message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <button type="submit" className="w-full py-2 bg-black text-white rounded">
                  Send Inquiry
                </button>
              </form>
            )}
          </section>
        );
      }
    `;

    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) return { object: sampleFilePlan };
      if (schema === FileCodeSchema) {
        if (prompt.includes("/components/Contact.js")) {
          // If this is a self-repair call, return repaired contact code
          if (/TARGETED REPAIR TASK|failed|repair/i.test(prompt)) {
            return { object: { path: "/components/Contact.js", code: repairedContactCode } };
          }
          return { object: { code: brokenContactCode } };
        }
        for (const [filePath, code] of Object.entries(portfolioFiles)) {
          if (prompt.includes(filePath)) return { object: { code } };
        }
        return { object: { code: portfolioFiles["/App.js"] } };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    const repairProgress = [];
    const callbacks = {
      onRepairStarted: async (data) => repairProgress.push({ event: "repair_started", data }),
      onRepairPlanCreated: async (data) => repairProgress.push({ event: "repair_plan_created", data }),
      onRepairAttemptStarted: async (data) => repairProgress.push({ event: "repair_attempt_started", data }),
      onRepairCandidateVerified: async (data) => repairProgress.push({ event: "repair_candidate_verified", data }),
      onRepairCompleted: async (data) => repairProgress.push({ event: "repair_completed", data }),
    };

    const result = await generateProject("Build a portfolio with contact form", callbacks);

    // Assert self-repair was triggered, executed, and accepted
    assert.ok(result.selfRepair, "SelfRepair report must be generated");
    assert.strictEqual(result.selfRepair.repairTriggered, true, "Repair must be marked triggered");
    assert.strictEqual(result.selfRepair.accepted, true, "Repaired candidate must be accepted");
    assert.strictEqual(result.selfRepair.attemptCount, 1, "Must succeed on attempt 1");
    assert.strictEqual(result.requirementVerification.mandatoryFailed, 0, "Mandatory failures must be resolved to 0");
    assert.ok(result.files["/components/Contact.js"].includes("onSubmit={handleSubmit}"), "Repaired code must be in project files");

    // Assert callback sequence
    const events = repairProgress.map((e) => e.event);
    assert.ok(events.includes("repair_started"), "Must emit onRepairStarted");
    assert.ok(events.includes("repair_plan_created"), "Must emit onRepairPlanCreated");
    assert.ok(events.includes("repair_attempt_started"), "Must emit onRepairAttemptStarted");
    assert.ok(events.includes("repair_completed"), "Must emit onRepairCompleted");
  });

  // --------------------------------------------------------------------------
  // Test D: Self-Repair Exhaustion (Repeated Failure, Bounded Retries, Rollback)
  // --------------------------------------------------------------------------
  it("Test D: Self-repair loop bounds retries at maxAttempts, detects repeated failure, rolls back, and emits onRepairExhausted", async () => {
    const brokenInitialFiles = {
      ...portfolioFiles,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <div>Under Construction</div>;
        }
      `,
    };

    let repairInvocations = 0;
    setAiGeneratorOverride(async ({ schema }) => {
      if (schema === FileCodeSchema) {
        repairInvocations++;
        // Candidate has syntax error on every repair attempt, failing Gate 1
        return {
          object: {
            path: "/components/Contact.js",
            code: `export default function Contact() { return <div>Unclosed JSX;`,
          },
        };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    const exhaustedEvents = [];
    const callbacks = {
      onRepairExhausted: async (data) => exhaustedEvents.push(data),
    };

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: brokenInitialFiles,
      prompt: "Build a portfolio with contact form",
      requirementContract: sampleContract,
      designSpec: sampleDesignSpec,
      filePlan: sampleFilePlan,
      callbacks,
      maxAttempts: 2,
    });

    // Verify bounded retry limit and failure behavior
    assert.strictEqual(result.success, false, "Self-repair must report success: false on exhaustion");
    assert.strictEqual(result.report.accepted, false, "Candidate must not be accepted");
    assert.ok(result.report.attemptCount <= 2, `Attempt count must not exceed 2 (got ${result.report.attemptCount})`);
    assert.strictEqual(result.report.rollbackPerformed, true, "Rollback must be performed to restore initial files");
    assert.strictEqual(result.files["/components/Contact.js"], brokenInitialFiles["/components/Contact.js"], "Files must match pre-repair baseline");
    assert.strictEqual(exhaustedEvents.length, 1, "Must emit onRepairExhausted event once");
  });

  // --------------------------------------------------------------------------
  // Test E: Invalid Structured AI Output Rejection
  // --------------------------------------------------------------------------
  it("Test E: Malformed or unparseable structured AI output is caught and rejected gracefully", async () => {
    setAiGeneratorOverride(async ({ schema }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) {
        // Return malformed object violating FilePlanSchema (missing files array)
        return {
          object: {
            projectName: "Broken Plan",
          },
        };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    await assert.rejects(
      async () => {
        await generateProject("Test malformed plan", {});
      },
      (err) => {
        assert.ok(err instanceof Error, "Should throw an Error");
        return true;
      },
      "Must reject when AI returns invalid schema output"
    );
  });

  // --------------------------------------------------------------------------
  // Test F: AI Provider Failure / Timeout Handling
  // --------------------------------------------------------------------------
  it("Test F: AI provider network timeout or rate limit error bubbles cleanly without process crash", async () => {
    setAiGeneratorOverride(async ({ schema }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) {
        const timeoutErr = new Error("Rate limit reached (429): Quota exceeded. Please try again later.");
        timeoutErr.status = 429;
        throw timeoutErr;
      }
      throw new Error("Should not reach here");
    });

    await assert.rejects(
      async () => {
        await generateProject("Test timeout", {});
      },
      (err) => {
        assert.ok(err.message.includes("Rate limit") || err.message.includes("429"));
        return true;
      },
      "Should cleanly reject with provider error message"
    );
  });

  // --------------------------------------------------------------------------
  // Test G: Runtime Verification Failure Rejection
  // --------------------------------------------------------------------------
  it("Test G: Project containing unrecoverable cross-file validation errors fails cleanly", async () => {
    const invalidPlan = {
      projectName: "Unrecoverable Project",
      projectDescription: "Fails cross-file prop contract validation",
      files: [
        { path: "/styles.css", description: "Styles", exports: "none" },
        { path: "/App.js", description: "Root", exports: "default App" },
        { path: "/components/Navbar.js", description: "Nav", exports: "default Navbar" },
      ],
    };

    const invalidFiles = {
      "/styles.css": `@tailwind base;`,
      "/App.js": `import React from 'react'; import Navbar from './components/Navbar'; export default function App() { return <Navbar />; }`,
      "/components/Navbar.js": `import React from 'react'; export default function Navbar({ nonExistentProp }) { return <button onClick={() => nonExistentProp.doSomething()}>Click</button>; }`,
    };

    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) return { object: invalidPlan };
      if (schema === FileCodeSchema) {
        if (prompt.includes("failed") || prompt.includes("Repair") || prompt.includes("TARGETED REPAIR TASK")) {
          // Repair attempt also fails to supply missing prop
          return { object: { path: "/App.js", code: invalidFiles["/App.js"] } };
        }
        for (const [filePath, code] of Object.entries(invalidFiles)) {
          if (prompt.includes(filePath)) return { object: { code } };
        }
        return { object: { code: invalidFiles["/App.js"] } };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    await assert.rejects(
      async () => {
        await generateProject("Test unrecoverable prop mismatch", {});
      },
      (err) => {
        assert.ok(
          err.message.includes("Project validation failed after self-repair attempts") ||
            err.message.includes("prop_contract_mismatch"),
          `Expected validation failure message, got: ${err.message}`
        );
        return true;
      },
      "Must reject generation when cross-file prop contracts cannot be resolved"
    );
  });

  // --------------------------------------------------------------------------
  // Test H: Controller & Database Persistence Behavior
  // --------------------------------------------------------------------------
  it("Test H: Controller creates pending project document and persists progress stages into MongoDB model", async () => {
    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) return { object: sampleContract };
      if (schema === DesignSpecSchema) return { object: sampleDesignSpec };
      if (schema === FilePlanSchema) return { object: sampleFilePlan };
      if (schema === FileCodeSchema) {
        for (const [filePath, code] of Object.entries(portfolioFiles)) {
          if (prompt.includes(filePath)) return { object: { code } };
        }
        return { object: { code: portfolioFiles["/App.js"] } };
      }
      throw new Error(`Unexpected schema: ${schema}`);
    });

    const updateCalls = [];
    const originalCreate = Project.create;
    const originalFindById = Project.findById;
    const originalFindByIdAndUpdate = Project.findByIdAndUpdate;

    const mockProjectDoc = {
      _id: "507f1f77bcf86cd799439011",
      name: "Planning project...",
      description: "Build portfolio",
      files: {},
      messages: [],
      version: 0,
      owner: "user_owner_123",
      status: "pending",
      filesPlanned: [],
      filesGenerated: [],
      currentFile: null,
      designSpec: null,
      requirementContract: null,
      requirementVerification: null,
      markModified: () => {},
      save: async function () {
        return this;
      },
    };

    Project.create = async (doc) => {
      return { ...mockProjectDoc, ...doc };
    };

    Project.findById = async () => mockProjectDoc;

    Project.findByIdAndUpdate = async (id, update) => {
      updateCalls.push({ id, update });
      return mockProjectDoc;
    };

    try {
      let statusCode = null;
      let responseBody = null;

      const req = {
        body: { prompt: "Build a modern portfolio for a senior designer" },
        user: { userID: "user_owner_123" },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
            },
          };
        },
      };

      await createProject(req, res);

      // Verify HTTP 201 response was delivered immediately with pending status
      assert.strictEqual(statusCode, 201, "createProject must return HTTP 201 Created");
      assert.strictEqual(responseBody.status, "pending", "Initial status in response must be pending");
      assert.strictEqual(responseBody.version, 0, "Initial version must be 0");

      // Allow background worker to execute progress steps
      for (let i = 0; i < 30; i++) {
        if (updateCalls.length > 0) break;
        await new Promise((r) => setTimeout(r, 20));
      }

      // Verify that Mongoose updates track progress stages (requirementContract, designSpec, plan)
      assert.ok(updateCalls.length > 0, "Background worker must invoke findByIdAndUpdate during generation");
      const updateKeys = updateCalls.map((c) => Object.keys(c.update)).flat();
      assert.ok(
        updateKeys.includes("requirementContract") || updateKeys.includes("status"),
        "Must persist progress stages to MongoDB model"
      );
    } finally {
      Project.create = originalCreate;
      Project.findById = originalFindById;
      Project.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });
});
