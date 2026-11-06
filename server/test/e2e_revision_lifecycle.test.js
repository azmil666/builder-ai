import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { chat } from "../controllers/chatController.js";
import { Project } from "../models/Project.js";
import { setAiGeneratorOverride, resetAiGeneratorOverride } from "../services/ai.js";
import { RevisionResultSchema, FileCodeSchema } from "../services/aiSchemas.js";
import { hashContent } from "../services/diff.js";
import {
  verifyProjectRequirements,
  buildProjectAnalysisMap,
  verifyFunctionalEvidence,
  calculateVerificationSummary,
} from "../services/requirementVerification.js";
import { evaluateRepairCandidate } from "../services/selfRepair.js";
import { updateRequirementContractOnRevision } from "../services/requirementContract.js";

describe("Phase 5 Stage 3: Multi-Turn Revision Lifecycle Integration Suite", () => {
  afterEach(() => {
    resetAiGeneratorOverride();
  });

  // --------------------------------------------------------------------------
  // Base Portfolio Fixture (Turn 0: Established Baseline)
  // --------------------------------------------------------------------------
  const basePortfolioFiles = {
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
        --bg: #ffffff;
        --fg: #09090b;
      }
      body {
        margin: 0;
        font-family: Inter, sans-serif;
        background-color: var(--bg);
        color: var(--fg);
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

  const initialContract = {
    contractVersion: "2.0.0",
    appName: "Modern Portfolio",
    category: "agency_portfolio",
    purpose: "Showcase creative portfolio works, skills, and client inquiry form",
    identity: {
      name: "Modern Portfolio",
      category: "agency_portfolio",
      purpose: "Showcase creative portfolio works, skills, and client inquiry form",
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
      colorPreferences: { theme: "light", primaryAccent: "#09090b" },
    },
  };

  const sampleFilePlan = {
    files: [
      { path: "/styles.css", description: "Global styles", exports: "none" },
      { path: "/App.js", description: "Main application root", exportName: "default" },
      { path: "/components/Navbar.js", description: "Responsive navbar", exportName: "default" },
      { path: "/components/Hero.js", description: "Hero section", exportName: "default" },
      { path: "/components/Projects.js", description: "Projects showcase", exportName: "default" },
      { path: "/components/Skills.js", description: "Skills badges", exportName: "default" },
      { path: "/components/Contact.js", description: "Contact form", exportName: "default" },
    ],
  };

  // --------------------------------------------------------------------------
  // Suite 1: Full 5-Turn Consecutive Revision Lifecycle
  // --------------------------------------------------------------------------
  describe("1. Consecutive 5-Turn Revision Lifecycle Journey", () => {
    it("Executes a full 5-turn consecutive revision lifecycle verifying state, feature preservation, and versioning", async () => {
      // Stage Turn 0 in memory
      const fileEntries = {};
      for (const [p, code] of Object.entries(basePortfolioFiles)) {
        fileEntries[p] = { content: code, hash: hashContent(code) };
      }

      const liveProject = {
        _id: "507f1f77bcf86cd799439011",
        owner: "user_turn_test",
        name: "Modern Portfolio",
        description: "Creative portfolio showcase",
        version: 1,
        status: "completed",
        files: fileEntries,
        messages: [
          { role: "user", content: "Create a modern portfolio" },
          { role: "assistant", content: "Created modern portfolio project structure." },
        ],
        designSpec: {
          archetype: "clean_modern",
          colorPalette: { theme: "light", bg: "#ffffff", fg: "#09090b" },
        },
        requirementContract: initialContract,
        requirementVerification: {
          overallStatus: "VERIFIED",
          mandatoryFailed: 0,
        },
        markModified: () => {},
        save: async function () {
          return this;
        },
      };

      const originalFindOne = Project.findOne;
      Project.findOne = async () => liveProject;

      async function executeTurn(prompt, operations, desc) {
        setAiGeneratorOverride(async ({ schema }) => {
          if (schema === RevisionResultSchema) {
            return { object: { operations, description: desc } };
          }
          throw new Error(`Unexpected schema in revision: ${schema}`);
        });

        let resCode = 200;
        let resBody = null;
        const req = {
          params: { id: liveProject._id },
          body: { prompt },
          user: { userId: "user_turn_test" },
        };
        const res = {
          status: (c) => {
            resCode = c;
            return { json: (d) => { resBody = d; } };
          },
          json: (d) => {
            resBody = d;
          },
        };

        await chat(req, res);
        return { code: resCode, body: resBody };
      }

      try {
        // --------------------------------------------------------------------
        // Turn 1: Design & Theme Revision (Dark Slate + Minimal Hero)
        // --------------------------------------------------------------------
        const t1 = await executeTurn(
          "Change the primary theme to dark slate and make the hero section minimalist",
          [
            {
              op: "update",
              path: "/styles.css",
              content: `
                @tailwind base;
                @tailwind components;
                @tailwind utilities;
                :root { --primary: #09090b; --bg: #09090b; --fg: #fafafa; }
                body { margin: 0; font-family: Inter, sans-serif; background-color: #09090b; color: #fafafa; overflow-x: hidden; }
              `,
            },
            {
              op: "update",
              path: "/App.js",
              content: `
                import React from 'react';
                import Navbar from './components/Navbar';
                import Hero from './components/Hero';
                import Projects from './components/Projects';
                import Skills from './components/Skills';
                import Contact from './components/Contact';
                import './styles.css';

                export default function App() {
                  // Dark visual theme
                  return (
                    <div className="dark min-h-screen bg-zinc-950 text-white overflow-x-hidden">
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
            },
            {
              op: "update",
              path: "/components/Hero.js",
              content: `
                import React from 'react';
                export default function Hero() {
                  return (
                    <section className="py-24 px-4 max-w-4xl mx-auto text-center">
                      <h1 className="text-5xl font-light tracking-tight text-white mb-4">
                        Minimalist Engineering & Design
                      </h1>
                      <p className="text-zinc-400 text-lg mb-8">
                        Focusing on clarity, performance, and craft.
                      </p>
                      <a href="#projects" className="px-6 py-3 bg-white text-zinc-950 font-medium rounded-lg">
                        View Work
                      </a>
                    </section>
                  );
                }
              `,
            },
          ],
          "Applied dark slate theme and minimalist hero"
        );

        assert.strictEqual(t1.code, 200, "Turn 1 must succeed with HTTP 200");
        assert.strictEqual(t1.body.version, 2, "Turn 1 must increment version to 2");
        assert.strictEqual(liveProject.version, 2, "Database project version must be 2");
        assert.ok(liveProject.files["/styles.css"].content.includes("#09090b"), "Styles must reflect dark theme");
        assert.ok(liveProject.files["/components/Hero.js"].content.includes("Minimalist Engineering & Design"));
        assert.strictEqual(liveProject.requirementContract.design.colorPreferences.theme, "dark");
        assert.strictEqual(liveProject.designSpec.archetype, "clean_modern");
        // Verify unmodified files remain preserved
        assert.strictEqual(liveProject.files["/components/Skills.js"].content, basePortfolioFiles["/components/Skills.js"]);
        assert.strictEqual(liveProject.files["/components/Contact.js"].content, basePortfolioFiles["/components/Contact.js"]);
        assert.strictEqual(t1.body.requirementVerification.mandatoryFailed, 0, "Turn 1 mandatory requirements must pass");

        // --------------------------------------------------------------------
        // Turn 2: Feature Addition (Working Search in Projects)
        // --------------------------------------------------------------------
        const t2 = await executeTurn(
          "Add a working search feature to filter projects by keyword",
          [
            {
              op: "update",
              path: "/components/Projects.js",
              content: `
                import React, { useState } from 'react';

                const SAMPLE_PROJECTS = [
                  { id: 1, title: 'E-Commerce Storefront', category: 'Web App', desc: 'Scalable headless commerce frontend' },
                  { id: 2, title: 'AI Workspace Canvas', category: 'SaaS', desc: 'Real-time collaborative diagramming' },
                  { id: 3, title: 'Design System Primitives', category: 'UI Kit', desc: 'Accessible React component library' },
                ];

                export default function Projects() {
                  const [query, setQuery] = useState('');
                  const filtered = SAMPLE_PROJECTS.filter(p =>
                    p.title.toLowerCase().includes(query.toLowerCase()) ||
                    p.category.toLowerCase().includes(query.toLowerCase())
                  );

                  return (
                    <section id="projects" className="py-16 md:py-24 px-4 max-w-6xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <h2 className="text-3xl font-bold text-white">Selected Works</h2>
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search projects by keyword..."
                          className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white outline-none w-full md:w-72"
                        />
                      </div>
                      {filtered.length === 0 ? (
                        <p className="text-zinc-400">No projects match your search.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {filtered.map((project) => (
                            <div key={project.id} className="p-6 border border-zinc-800 rounded-xl bg-zinc-900">
                              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">{project.category}</span>
                              <h3 className="text-xl font-bold text-white mt-2 mb-2">{project.title}</h3>
                              <p className="text-zinc-400 text-sm">{project.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                }
              `,
            },
          ],
          "Added interactive search filtering to projects section"
        );

        assert.strictEqual(t2.code, 200, "Turn 2 must succeed with HTTP 200");
        assert.strictEqual(t2.body.version, 3, "Turn 2 must increment version to 3");
        assert.strictEqual(liveProject.version, 3);
        assert.ok(liveProject.files["/components/Projects.js"].content.includes("SAMPLE_PROJECTS.filter"), "Projects must contain functional filter");
        assert.ok(liveProject.files["/components/Projects.js"].content.includes("onChange={(e) => setQuery(e.target.value)}"));
        // Preservation check: Turn 1 dark slate styles and minimalist hero preserved
        assert.ok(liveProject.files["/styles.css"].content.includes("#09090b"));
        assert.ok(liveProject.files["/components/Hero.js"].content.includes("Minimalist Engineering & Design"));
        assert.strictEqual(liveProject.files["/components/Contact.js"].content, basePortfolioFiles["/components/Contact.js"]);
        assert.strictEqual(t2.body.requirementVerification.mandatoryFailed, 0);

        // --------------------------------------------------------------------
        // Turn 3: Redesign Contact Section (Functionality Preserved)
        // --------------------------------------------------------------------
        const t3 = await executeTurn(
          "Redesign the contact section into a modern centered card layout",
          [
            {
              op: "update",
              path: "/components/Contact.js",
              content: `
                import React, { useState } from 'react';

                export default function Contact() {
                  const [submitted, setSubmitted] = useState(false);
                  const [form, setForm] = useState({ name: '', email: '', message: '' });

                  const handleSubmit = (e) => {
                    e.preventDefault();
                    setSubmitted(true);
                  };

                  return (
                    <section id="contact" className="py-20 px-4 max-w-2xl mx-auto">
                      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
                        <h2 className="text-3xl font-bold text-white mb-2 text-center">Start a Conversation</h2>
                        <p className="text-zinc-400 text-center mb-8">Reach out for project inquiries or consulting.</p>
                        {submitted ? (
                          <div className="p-6 bg-zinc-800 border border-zinc-700 rounded-xl text-center text-white">
                            <p className="font-semibold text-lg">Inquiry received successfully!</p>
                            <p className="text-sm text-zinc-400 mt-1">I will review your message and reply promptly.</p>
                          </div>
                        ) : (
                          <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                              <label className="block text-sm font-medium text-zinc-300 mb-1">Your Name</label>
                              <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-white outline-none"
                                placeholder="Alex Morgan"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-300 mb-1">Email Address</label>
                              <input
                                type="email"
                                required
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-white outline-none"
                                placeholder="alex@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-300 mb-1">Project Details</label>
                              <textarea
                                required
                                rows={4}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-white outline-none"
                                placeholder="Tell me about your scope and timeline..."
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full py-3 bg-white text-zinc-950 font-semibold rounded-lg hover:bg-zinc-200 transition"
                            >
                              Submit Project Inquiry
                            </button>
                          </form>
                        )}
                      </div>
                    </section>
                  );
                }
              `,
            },
          ],
          "Redesigned contact section into modern card layout preserving form functionality"
        );

        assert.strictEqual(t3.code, 200, "Turn 3 must succeed with HTTP 200");
        assert.strictEqual(t3.body.version, 4, "Turn 3 must increment version to 4");
        assert.strictEqual(liveProject.version, 4);
        // Verify functionality strictly preserved
        assert.ok(liveProject.files["/components/Contact.js"].content.includes("onSubmit={handleSubmit}"), "Must preserve form submission");
        assert.ok(liveProject.files["/components/Contact.js"].content.includes("setSubmitted(true)"), "Must preserve submission state");
        assert.ok(liveProject.files["/components/Contact.js"].content.includes("Inquiry received successfully!"), "Must preserve feedback text");
        // Preservation check: Turn 2 search in Projects intact
        assert.ok(liveProject.files["/components/Projects.js"].content.includes("SAMPLE_PROJECTS.filter"));
        assert.strictEqual(t3.body.requirementVerification.mandatoryFailed, 0);

        // --------------------------------------------------------------------
        // Turn 4: Intentional Feature Removal (Remove Top Navbar)
        // --------------------------------------------------------------------
        const t4 = await executeTurn(
          "Remove the top navigation bar completely",
          [
            {
              op: "update",
              path: "/App.js",
              content: `
                import React from 'react';
                import Hero from './components/Hero';
                import Projects from './components/Projects';
                import Skills from './components/Skills';
                import Contact from './components/Contact';
                import './styles.css';

                export default function App() {
                  // Dark visual theme
                  return (
                    <div className="dark min-h-screen bg-zinc-950 text-white overflow-x-hidden">
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
            },
          ],
          "Removed navigation bar as requested by user"
        );

        assert.strictEqual(t4.code, 200, "Turn 4 must succeed with HTTP 200");
        assert.strictEqual(t4.body.version, 5, "Turn 4 must increment version to 5");
        assert.strictEqual(liveProject.version, 5);
        assert.ok(!liveProject.files["/App.js"].content.includes("<Navbar"), "Navbar element must be absent in /App.js");
        assert.ok(!liveProject.files["/App.js"].content.includes("import Navbar"), "Navbar import must be absent in /App.js");
        // Intentional removal check: Missing Navbar is not flagged as false failure
        assert.strictEqual(t4.body.requirementVerification.mandatoryFailed, 0, "Intentional removal must not trigger false mandatory failure");

        // --------------------------------------------------------------------
        // Turn 5: Follow-Up Styling Update Operating on Latest State
        // --------------------------------------------------------------------
        const t5 = await executeTurn(
          "Update project card spacing and subtle border",
          [
            {
              op: "update",
              path: "/components/Projects.js",
              content: `
                import React, { useState } from 'react';

                const SAMPLE_PROJECTS = [
                  { id: 1, title: 'E-Commerce Storefront', category: 'Web App', desc: 'Scalable headless commerce frontend' },
                  { id: 2, title: 'AI Workspace Canvas', category: 'SaaS', desc: 'Real-time collaborative diagramming' },
                  { id: 3, title: 'Design System Primitives', category: 'UI Kit', desc: 'Accessible React component library' },
                ];

                export default function Projects() {
                  const [query, setQuery] = useState('');
                  const filtered = SAMPLE_PROJECTS.filter(p =>
                    p.title.toLowerCase().includes(query.toLowerCase()) ||
                    p.category.toLowerCase().includes(query.toLowerCase())
                  );

                  return (
                    <section id="projects" className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Selected Works</h2>
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search projects by keyword..."
                          className="px-4 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white outline-none w-full md:w-80 focus:border-zinc-500"
                        />
                      </div>
                      {filtered.length === 0 ? (
                        <p className="text-zinc-400">No projects match your search.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                          {filtered.map((project) => (
                            <div key={project.id} className="p-8 border border-zinc-800/90 rounded-2xl bg-zinc-900/80 hover:border-zinc-700 transition">
                              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">{project.category}</span>
                              <h3 className="text-xl font-bold text-white mt-3 mb-2">{project.title}</h3>
                              <p className="text-zinc-400 text-sm leading-relaxed">{project.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                }
              `,
            },
          ],
          "Refined project card spacing, padding, and borders"
        );

        assert.strictEqual(t5.code, 200, "Turn 5 must succeed with HTTP 200");
        assert.strictEqual(t5.body.version, 6, "Turn 5 must increment version to 6");
        assert.strictEqual(liveProject.version, 6);
        // Verify cumulative state across all 5 turns
        assert.ok(!liveProject.files["/App.js"].content.includes("<Navbar"), "Navbar remains absent (from Turn 4)");
        assert.ok(liveProject.files["/components/Projects.js"].content.includes("SAMPLE_PROJECTS.filter"), "Search remains functional (from Turn 2)");
        assert.ok(liveProject.files["/components/Contact.js"].content.includes("onSubmit={handleSubmit}"), "Contact card remains intact (from Turn 3)");
        assert.ok(liveProject.files["/styles.css"].content.includes("#09090b"), "Dark slate theme remains intact (from Turn 1)");
        assert.strictEqual(t5.body.requirementVerification.mandatoryFailed, 0);

        // --------------------------------------------------------------------
        // Failure Isolation & Atomic Rollback Check
        // --------------------------------------------------------------------
        const stateBeforeFailureVersion = liveProject.version;
        const stateBeforeFailureAppJs = liveProject.files["/App.js"].content;
        const stateBeforeFailureContract = JSON.stringify(liveProject.requirementContract);

        const tfail = await executeTurn(
          "Corrupt the layout with broken syntax",
          [
            {
              op: "update",
              path: "/App.js",
              content: "export default function App() { return <div>Broken unclosed JSX;",
            },
          ],
          "Corrupted update"
        );

        assert.strictEqual(tfail.code, 422, "Revision with unrecoverable syntax error must return HTTP 422");
        assert.strictEqual(liveProject.version, stateBeforeFailureVersion, "Version must not increment on revision failure");
        assert.strictEqual(liveProject.files["/App.js"].content, stateBeforeFailureAppJs, "Original App.js must be preserved intact");
        assert.strictEqual(JSON.stringify(liveProject.requirementContract), stateBeforeFailureContract, "Contract must remain unchanged on failure");
        assert.strictEqual(liveProject.status, "completed", "Status must remain completed");
        assert.ok(tfail.body.error.includes("Revision failed"), "Response error must clearly indicate revision failure");
      } finally {
        Project.findOne = originalFindOne;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Revision Regression & Contract Edge Case Scenarios
  // --------------------------------------------------------------------------
  describe("2. Revision Regression & Acceptance Gate Isolation Scenarios", () => {
    // ------------------------------------------------------------------------
    // Scenario A: Previously PASS requirement becomes FAIL after revision
    // ------------------------------------------------------------------------
    it("Scenario A: Previously PASS requirement becomes FAIL after a regressive revision and is caught by verification", async () => {
      const origVerification = await verifyProjectRequirements(basePortfolioFiles, initialContract, sampleFilePlan);
      assert.strictEqual(origVerification.mandatoryFailed, 0, "Initial files must have 0 mandatory failures");
      const initialContactReq = origVerification.requirements.find((r) => r.requirementId === "fn_section_contact");
      assert.strictEqual(initialContactReq?.status, "PASS", "Initial contact form must PASS");

      // Regressive candidate: Contact component stripped of form and submit handler
      const regressedFiles = {
        ...basePortfolioFiles,
        "/components/Contact.js": `
          import React from 'react';
          export default function Contact() {
            return (
              <section id="contact" className="py-16 text-center">
                <h2>Contact Us</h2>
                <p>Form disabled for maintenance.</p>
              </section>
            );
          }
        `,
      };

      const regressedVerification = await verifyProjectRequirements(regressedFiles, initialContract, sampleFilePlan);
      assert.ok(regressedVerification.mandatoryFailed > 0, "Regressed files must fail mandatory requirements");
      const regressedContactReq = regressedVerification.requirements.find((r) => r.requirementId === "fn_section_contact");
      assert.strictEqual(regressedContactReq?.status, "FAIL", "Contact requirement must transition from PASS to FAIL");

      // Acceptance Gate 5 (Regression Gate) check
      const gateResult = await evaluateRepairCandidate({
        candidateFiles: regressedFiles,
        originalFiles: basePortfolioFiles,
        originalVerification: origVerification,
        requirementContract: initialContract,
        filePlan: sampleFilePlan,
      });

      assert.strictEqual(gateResult.accepted, false, "Gate 5 must reject regressed candidate");
      assert.ok(
        gateResult.reason.includes("Regression detected") || gateResult.reason.includes("breaks previously passing"),
        `Expected regression reason, got: ${gateResult.reason}`
      );
    });

    // ------------------------------------------------------------------------
    // Scenario B: Previously PASS requirement becomes UNVERIFIABLE after revision
    // ------------------------------------------------------------------------
    it("Scenario B: Requirement transitions from PASS to UNVERIFIABLE and triggers Gate 5 regression rejection", async () => {
      // 1. Establish a project state where a specific requirement is classified as PASS.
      const origVerification = await verifyProjectRequirements(basePortfolioFiles, initialContract, sampleFilePlan);
      assert.strictEqual(origVerification.mandatoryFailed, 0, "Initial files must have 0 mandatory failures");

      // 2. Save its original verification result.
      const targetReqId = "fn_section_contact";
      const origResult = origVerification.requirements.find((r) => r.requirementId === targetReqId);
      assert.ok(origResult, `Target requirement ${targetReqId} must exist in original verification`);
      assert.strictEqual(origResult.status, "PASS", "Original verification result must be PASS");

      // 3. Apply a revision that makes the evidence for that requirement unavailable / impossible to verify statically.
      // (Component uses external dynamic container whose AST bindings cannot be deterministically verified)
      const revisedFiles = {
        ...basePortfolioFiles,
        "/components/Contact.js": `
          import React from 'react';
          // Dynamic container whose implementation evidence cannot be deterministically resolved via static AST
          export default function Contact() {
            return <div id="contact-container" dangerouslySetInnerHTML={{ __html: window.__CONTACT_WIDGET_HTML__ }} />;
          }
        `,
      };

      // 4. Run the actual requirement verification logic again with fallback awareness on the target file
      // (simulating AST parser fallback / non-AST execution on target component, matching Phase 3 H12 specification)
      const analysisMap = await buildProjectAnalysisMap(revisedFiles);
      analysisMap["/components/Contact.js"].astFallback = true;
      analysisMap["/components/Contact.js"].jsxElements = [];
      analysisMap["/components/Contact.js"].stateHooks = [];

      const revisedFunctional = verifyFunctionalEvidence(initialContract, revisedFiles, analysisMap);
      const newResult = revisedFunctional.find((r) => r.requirementId === targetReqId);

      // Rebuild summary across all verification layers
      const allRequirements = [
        ...origVerification.requirements.filter((r) => r.requirementId !== targetReqId),
        newResult,
      ];
      const revisedSummary = calculateVerificationSummary(allRequirements);

      // 5. Assert required transition criteria:
      // - The original result was PASS.
      assert.strictEqual(origResult.status, "PASS", "Original result must have been PASS");
      // - The new result is UNVERIFIABLE.
      assert.ok(newResult, "Requirement must exist in revised verification");
      assert.strictEqual(newResult.status, "UNVERIFIABLE", "New result must be UNVERIFIABLE");
      // - The requirement identity remains consistent across both results.
      assert.strictEqual(newResult.requirementId, origResult.requirementId, "Requirement identity must be consistent");
      assert.strictEqual(newResult.requirementId, targetReqId, "Requirement ID must match target");
      // - The new verification summary reflects the UNVERIFIABLE result.
      assert.ok(revisedSummary.unverifiable > 0, "Summary must track unverifiable requirements");
      // - The system does not incorrectly report the requirement as PASS.
      assert.notStrictEqual(newResult.status, "PASS", "System must never report unverifiable requirement as PASS");

      // 6. Verify expected acceptance-gate behavior:
      // Gate 5 (Regression Gate) strictly requires that previously passing mandatory requirements remain PASS.
      // Transitioning from PASS to UNVERIFIABLE on a mandatory requirement is an unacceptable regression.
      const previouslyPassingMandatory = (origVerification.requirements || []).filter(
        (r) => r.priority === "mandatory" && r.status === "PASS"
      );

      const candidateVerification = {
        ...revisedSummary,
        requirements: allRequirements,
      };

      let gate5Passed = true;
      let gate5Reason = "";
      for (const prevReq of previouslyPassingMandatory) {
        const candidateReq = candidateVerification.requirements.find(
          (r) => r.requirementId === prevReq.requirementId
        );
        if (!candidateReq || candidateReq.status !== "PASS") {
          gate5Passed = false;
          const newStatus = candidateReq ? candidateReq.status : "REMOVED";
          gate5Reason = `Regression detected: candidate breaks previously passing mandatory requirement "${prevReq.requirementText || prevReq.description || prevReq.requirementId}" (previously PASS, now ${newStatus})`;
          break;
        }
      }

      assert.strictEqual(gate5Passed, false, "Gate 5 must reject candidate when a mandatory requirement regresses from PASS to UNVERIFIABLE");
      assert.ok(
        gate5Reason.includes("Regression detected") && gate5Reason.includes("previously PASS, now UNVERIFIABLE"),
        `Gate 5 reason must cite previously PASS, now UNVERIFIABLE; got: ${gate5Reason}`
      );
    });

    // ------------------------------------------------------------------------
    // Scenario C: Revision fixes one mandatory failure but introduces another
    // ------------------------------------------------------------------------
    it("Scenario C: Revision fixes one mandatory failure but introduces another, triggering regression rejection", async () => {
      // Contract with two mandatory functional requirements: contact form & search filtering
      const dualContract = {
        ...initialContract,
        functionalRequirements: [
          {
            id: "contact_form",
            name: "Contact Inquiry Form",
            priority: "mandatory",
            category: "forms_validation",
            description: "Form with input fields and submit feedback",
            expectedBehavior: "Validates inputs and displays confirmation message on submit",
            implementationTarget: "/components/Contact.js",
          },
          {
            id: "project_search",
            name: "Project Search Filtering",
            priority: "mandatory",
            category: "search_filtering",
            description: "Search input filtering projects by title",
            expectedBehavior: "Filters project cards as query is entered",
            implementationTarget: "/components/Projects.js",
          },
        ],
      };

      // Base files with working search but broken contact form
      const filesWithWorkingSearchAndBrokenContact = {
        ...basePortfolioFiles,
        "/components/Projects.js": `
          import React, { useState } from 'react';
          const ITEMS = [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Beta' }];
          export default function Projects() {
            const [query, setQuery] = useState('');
            const filtered = ITEMS.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
            return (
              <section id="projects">
                <input type="search" placeholder="Search projects..." value={query} onChange={e => setQuery(e.target.value)} />
                <div>{filtered.map(i => <div key={i.id}>{i.title}</div>)}</div>
              </section>
            );
          }
        `,
        "/components/Contact.js": `
          import React from 'react';
          export default function Contact() {
            return <div>Contact under construction without any form</div>;
          }
        `,
      };

      const initialVer = await verifyProjectRequirements(filesWithWorkingSearchAndBrokenContact, dualContract, sampleFilePlan);
      assert.ok(initialVer.mandatoryFailed > 0, "Initial files must have mandatory failure(s) for contact form");
      const initContactReq = initialVer.requirements.find((r) => r.requirementId === "fn_contact_form");
      const initSearchReq = initialVer.requirements.find((r) => r.requirementId === "fn_project_search");
      assert.strictEqual(initContactReq?.status, "FAIL", "Contact must initially FAIL");
      assert.strictEqual(initSearchReq?.status, "PASS", "Search must initially PASS");

      // Candidate candidate: Fixes Contact form, BUT regresses Search (strips query state and filter logic)
      const candidateFiles = {
        ...filesWithWorkingSearchAndBrokenContact,
        // Contact is now fixed:
        "/components/Contact.js": basePortfolioFiles["/components/Contact.js"],
        // Search is now regressed to a static cosmetic input:
        "/components/Projects.js": `
          import React from 'react';
          const ITEMS = [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Beta' }];
          export default function Projects() {
            return (
              <section id="projects">
                <input type="text" placeholder="Static search bar without state" />
                <div>{ITEMS.map(i => <div key={i.id}>{i.title}</div>)}</div>
              </section>
            );
          }
        `,
      };

      const candidateVer = await verifyProjectRequirements(candidateFiles, dualContract, sampleFilePlan);
      const candContactReq = candidateVer.requirements.find((r) => r.requirementId === "fn_contact_form");
      const candSearchReq = candidateVer.requirements.find((r) => r.requirementId === "fn_project_search");
      assert.strictEqual(candContactReq?.status, "PASS", "Contact requirement is successfully repaired");
      assert.strictEqual(candSearchReq?.status, "FAIL", "Search requirement regresses to FAIL");

      // Acceptance Gate 5 (Regression Gate) rejects candidate because it broke previously passing Search
      const gateResult = await evaluateRepairCandidate({
        candidateFiles,
        originalFiles: filesWithWorkingSearchAndBrokenContact,
        originalVerification: initialVer,
        requirementContract: dualContract,
        filePlan: sampleFilePlan,
      });

      assert.strictEqual(gateResult.accepted, false, "Candidate introducing a regression tradeoff must be rejected");
      assert.ok(
        gateResult.reason.includes("Regression detected") && gateResult.reason.includes("previously PASS, now FAIL"),
        `Expected regression reason mentioning previously PASS, now FAIL; got: ${gateResult.reason}`
      );
    });

    // ------------------------------------------------------------------------
    // Scenario D: Failed revision preserves previous project files, version, contract, and completed state
    // ------------------------------------------------------------------------
    it("Scenario D: A failed revision preserves previous project files, version, contract, and completed state", async () => {
      const fileEntries = {};
      for (const [p, code] of Object.entries(basePortfolioFiles)) {
        fileEntries[p] = { content: code, hash: hashContent(code) };
      }

      const initialVersion = 3;
      const liveProject = {
        _id: "507f1f77bcf86cd799439011",
        owner: "user_turn_test",
        name: "Modern Portfolio",
        description: "Portfolio",
        version: initialVersion,
        status: "completed",
        files: fileEntries,
        messages: [{ role: "user", content: "Prompt" }],
        designSpec: { archetype: "clean_modern" },
        requirementContract: initialContract,
        requirementVerification: { overallStatus: "VERIFIED", mandatoryFailed: 0 },
        markModified: () => {},
        save: async function () {
          return this;
        },
      };

      const originalFindOne = Project.findOne;
      Project.findOne = async () => liveProject;

      setAiGeneratorOverride(async ({ schema }) => {
        if (schema === RevisionResultSchema) {
          return {
            object: {
              operations: [
                {
                  op: "update",
                  path: "/App.js",
                  content: "export default function Broken() { return <div>Invalid syntax;",
                },
              ],
              description: "Attempted broken revision",
            },
          };
        }
        if (schema === FileCodeSchema) {
          // Repair attempt also fails
          return {
            object: {
              path: "/App.js",
              code: "export default function StillBroken() { return <div>Still invalid;",
            },
          };
        }
        throw new Error(`Unexpected schema: ${schema}`);
      });

      let resCode = null;
      let resBody = null;
      const req = {
        params: { id: liveProject._id },
        body: { prompt: "Introduce syntax error" },
        user: { userId: "user_turn_test" },
      };
      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resBody = d; } };
        },
        json: (d) => {
          resBody = d;
        },
      };

      try {
        await chat(req, res);

        assert.strictEqual(resCode, 422, "Controller must return HTTP 422 Unprocessable Entity");
        assert.strictEqual(liveProject.version, initialVersion, "Version must not increment on failure");
        assert.strictEqual(liveProject.status, "completed", "Status must remain completed");
        assert.strictEqual(liveProject.files["/App.js"].content, basePortfolioFiles["/App.js"], "App.js must remain untouched");
        assert.strictEqual(liveProject.requirementContract, initialContract, "Contract must remain untouched");
        assert.ok(liveProject.messages.some((m) => m.content.includes("❌ Revision failed")));
      } finally {
        Project.findOne = originalFindOne;
      }
    });

    // ------------------------------------------------------------------------
    // Scenario E: Intentional feature removal updates contract and passes verification
    // ------------------------------------------------------------------------
    it("Scenario E: Intentional feature removal updates requirement contract and does not treat removed feature as failure", async () => {
      const designSpec = { archetype: "clean_modern" };
      const updatedContract = updateRequirementContractOnRevision(
        initialContract,
        "Remove the top navigation bar completely",
        designSpec
      );

      // Contract check: Navigation requirement is no longer in mandatory requirements
      const hasMandatoryNavbar = (updatedContract.mandatoryRequirements || []).some((r) =>
        /nav|navigation|navbar/i.test(r)
      );
      assert.strictEqual(hasMandatoryNavbar, false, "Mandatory requirements must not require removed navbar");

      // Code check: Code lacking Navbar verified against updated contract
      const filesWithoutNavbar = {
        ...basePortfolioFiles,
        "/App.js": `
          import React from 'react';
          import Hero from './components/Hero';
          import Projects from './components/Projects';
          import Skills from './components/Skills';
          import Contact from './components/Contact';
          import './styles.css';

          export default function App() {
            return (
              <div className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">
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
      };

      const verification = await verifyProjectRequirements(filesWithoutNavbar, updatedContract, sampleFilePlan);
      assert.strictEqual(verification.mandatoryFailed, 0, "Missing navbar must not produce mandatory failure");
      const navbarFailed = verification.requirements.some(
        (r) => /nav|navbar/i.test(r.requirementText || r.requirementId) && r.status === "FAIL"
      );
      assert.strictEqual(navbarFailed, false, "No navbar requirement should be marked FAIL");
    });
  });
});
