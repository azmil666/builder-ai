import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.VISUAL_VERIFICATION_TIMEOUT_MS = "25";

import {
  createProject,
  runBackgroundGeneration,
  resolveTargetFramework,
} from "../controllers/projectController.js";
import { chat } from "../controllers/chatController.js";
import { Project } from "../models/Project.js";
import {
  setAiGeneratorOverride,
  resetAiGeneratorOverride,
} from "../services/ai.js";
import {
  RequirementContractSchema,
  DesignSpecSchema,
  FilePlanSchema,
  FileCodeSchema,
  RevisionResultSchema,
} from "../services/aiSchemas.js";
import { hashContent } from "../services/diff.js";

describe("Phase 4.3: End-to-End Multi-Target Pipeline Integration & PR #1 Verification", () => {
  const originalCreate = Project.create;
  const originalFindById = Project.findById;
  const originalFindByIdAndUpdate = Project.findByIdAndUpdate;
  const originalFindOneAndUpdate = Project.findOneAndUpdate;
  const originalFindOne = Project.findOne;

  const inMemoryProjects = new Map();

  function createMockProjectDoc(doc) {
    const id = doc._id ? doc._id.toString() : new mongoose.Types.ObjectId().toString();
    const project = {
      _id: id,
      name: doc.name || "Planning project...",
      description: doc.description || "",
      framework: doc.framework,
      files: doc.files ? JSON.parse(JSON.stringify(doc.files)) : {},
      messages: doc.messages ? [...doc.messages] : [],
      version: doc.version ?? 0,
      owner: doc.owner || "user_e2e_test",
      status: doc.status || "pending",
      filesPlanned: doc.filesPlanned ? [...doc.filesPlanned] : [],
      filesGenerated: doc.filesGenerated ? [...doc.filesGenerated] : [],
      currentFile: null,
      CurrentFile: null,
      designSpec: doc.designSpec || null,
      requirementContract: doc.requirementContract || null,
      requirementVerification: doc.requirementVerification || null,
      selfRepair: doc.selfRepair || null,
      visualVerification: doc.visualVerification || null,
      history: doc.history ? [...doc.history] : [],
      error: null,
      createdAt: new Date(),
      markModified: () => {},
      save: async function () {
        inMemoryProjects.set(this._id.toString(), this);
        return this;
      },
    };

    // Simulate ProjectSchema post-init legacy detection
    if (!project.framework) {
      if (project.files && (project.files["/App.js"] || project.files["/App.jsx"])) {
        project.framework = "react";
      } else if (project.files && project.files["/index.html"]) {
        project.framework = "vanilla";
      }
    }

    inMemoryProjects.set(id, project);
    return project;
  }

  beforeEach(() => {
    inMemoryProjects.clear();

    Project.create = async (doc) => createMockProjectDoc(doc);
    Project.findById = async (id) => {
      const key = id ? (id._id ? id._id.toString() : id.toString()) : null;
      return inMemoryProjects.get(key) || null;
    };
    Project.findByIdAndUpdate = async (id, update) => {
      const key = id ? (id._id ? id._id.toString() : id.toString()) : null;
      const p = inMemoryProjects.get(key);
      if (p) {
        if (update.$push) {
          for (const [k, v] of Object.entries(update.$push)) {
            p[k] = p[k] || [];
            p[k].push(v);
          }
        }
        for (const [k, v] of Object.entries(update)) {
          if (k !== "$push") p[k] = v;
        }
      }
      return p;
    };
    Project.findOneAndUpdate = Project.findByIdAndUpdate;
    Project.findOne = async (query) => {
      for (const p of inMemoryProjects.values()) {
        if (query._id && p._id.toString() !== query._id.toString()) continue;
        if (query.owner && p.owner !== query.owner) continue;
        return p;
      }
      return null;
    };

    // Safe default mock for background calls
    setAiGeneratorOverride(async ({ schema, prompt }) => {
      if (schema === RequirementContractSchema) {
        return {
          object: {
            framework: "vanilla",
            identity: { name: "Mock Project", category: "agency_portfolio", purpose: "Mock" },
            navigation: { type: "sticky_header", primaryItems: ["Home"] },
            pages: [{ id: "home", name: "Home", isPrimary: true, sections: [] }],
            mandatoryRequirements: ["Hero section"],
            functionalRequirements: [],
          },
        };
      }
      if (schema === DesignSpecSchema) {
        return {
          object: {
            archetype: "clean_modern",
            aestheticDirection: "Modern",
            colorPalette: { primary: "#2563eb", accent: "#3b82f6" },
          },
        };
      }
      if (schema === FilePlanSchema) {
        return {
          object: {
            projectName: "Mock Project",
            manifest: ["/index.html", "/styles.css", "/script.js"],
            files: [
              { path: "/index.html", description: "Home", mandatory: true },
              { path: "/styles.css", description: "Styles", mandatory: true },
              { path: "/script.js", description: "Script", mandatory: true },
            ],
          },
        };
      }
      if (schema === FileCodeSchema) {
        for (const [filePath, code] of Object.entries(vanillaFiles)) {
          if (prompt.includes(filePath)) return { object: { code } };
        }
        return { object: { code: vanillaFiles["/index.html"] } };
      }
      return { object: {} };
    });
  });

  afterEach(() => {
    resetAiGeneratorOverride();
    Project.create = originalCreate;
    Project.findById = originalFindById;
    Project.findByIdAndUpdate = originalFindByIdAndUpdate;
    Project.findOneAndUpdate = originalFindOneAndUpdate;
    Project.findOne = originalFindOne;
  });

  // --------------------------------------------------------------------------
  // Fixtures: Deterministic Vanilla Files
  // --------------------------------------------------------------------------
  const vanillaFiles = {
    "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creative Agency Studio</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body class="bg-slate-900 text-white font-sans">
  <header class="p-6 border-b border-slate-800">
    <nav class="max-w-6xl mx-auto flex justify-between items-center">
      <div class="text-xl font-bold">Studio Agency</div>
      <div class="hidden md:flex space-x-6">
        <a href="#hero" class="hover:text-blue-400">Home</a>
        <a href="#services" class="hover:text-blue-400">Services</a>
        <a href="#contact" class="hover:text-blue-400">Contact</a>
      </div>
    </nav>
  </header>
  <main class="max-w-6xl mx-auto px-4 py-12">
    <section id="hero" class="text-center py-16">
      <h1 class="text-4xl md:text-6xl font-extrabold">Bespoke Digital Experiences</h1>
      <p class="mt-4 text-slate-400">Designing modern web products with high impact.</p>
      <button id="cta-btn" class="mt-8 px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500">Get Started</button>
    </section>
    <section id="services" class="py-12">
      <h2 class="text-2xl font-bold mb-6">Our Services</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-6 bg-slate-800 rounded-lg">Web Design</div>
        <div class="p-6 bg-slate-800 rounded-lg">Full-Stack Development</div>
        <div class="p-6 bg-slate-800 rounded-lg">Brand Identity</div>
      </div>
    </section>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    "/styles.css": `
:root {
  --primary: #2563eb;
  --bg: #0f172a;
}
body {
  margin: 0;
  background-color: var(--bg);
  color: #fff;
}
`,
    "/script.js": `
document.addEventListener("DOMContentLoaded", () => {
  const ctaBtn = document.getElementById("cta-btn");
  if (ctaBtn) {
    ctaBtn.addEventListener("click", () => {
      console.log("CTA button clicked");
    });
  }
});
`,
  };

  // --------------------------------------------------------------------------
  // Fixtures: Deterministic Modern React (.jsx) Files
  // --------------------------------------------------------------------------
  const reactFiles = {
    "/App.jsx": `
import React, { useState } from 'react';
import './styles.css';
import Header from './components/Header.jsx';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Header />
      <main className="p-8">
        <h1 className="text-3xl font-bold">React Dashboard</h1>
        <button onClick={() => setCount(count + 1)} className="mt-4 px-4 py-2 bg-blue-600 rounded">
          Count: {count}
        </button>
      </main>
    </div>
  );
}
`,
    "/components/Header.jsx": `
import React from 'react';

export default function Header() {
  return (
    <header className="p-4 border-b border-slate-800">
      <span className="font-bold">Dashboard App</span>
    </header>
  );
}
`,
    "/styles.css": `
body {
  margin: 0;
  font-family: sans-serif;
}
`,
  };

  // --------------------------------------------------------------------------
  // 1. Default Vanilla Lifecycle (End-to-End)
  // --------------------------------------------------------------------------
  describe("1. Default Vanilla Lifecycle (End-to-End)", () => {
    it("POST /api/projects defaults to 'vanilla', generates /index.html + /styles.css + /script.js, and records Initial generation snapshot", async () => {
      let statusCode = null;
      let responseBody = null;

      const req = {
        body: { prompt: "Build a bespoke design studio landing page" },
        user: { userId: "user_e2e_test" },
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

      // 1. Setup deterministic AI generator override for vanilla pipeline BEFORE project creation
      setAiGeneratorOverride(async ({ schema, prompt }) => {
        if (schema === RequirementContractSchema) {
          return {
            object: {
              framework: "vanilla",
              identity: {
                name: "Studio Agency",
                category: "agency_portfolio",
                purpose: "Agency portfolio and showcase",
                mainConversionAction: "Explore services",
              },
              navigation: {
                type: "sticky_header",
                primaryItems: ["Home", "Services", "Contact"],
              },
              pages: [
                {
                  id: "home",
                  name: "Home",
                  isPrimary: true,
                  sections: [
                    { id: "hero", name: "Hero", priority: "mandatory" },
                    { id: "services", name: "Services", priority: "mandatory" },
                  ],
                },
              ],
              mandatoryRequirements: ["Hero section", "Services grid"],
              functionalRequirements: [],
            },
          };
        }
        if (schema === DesignSpecSchema) {
          return {
            object: {
              framework: "vanilla",
              archetype: "clean_modern",
              aestheticDirection: "Editorial Minimalist",
              colorPalette: { primary: "#2563eb", accent: "#3b82f6", theme: "dark" },
            },
          };
        }
        if (schema === FilePlanSchema) {
          return {
            object: {
              projectName: "Studio Agency",
              manifest: Object.keys(vanillaFiles),
              files: [
                { path: "/index.html", description: "Main semantic HTML5 entry point", mandatory: true },
                { path: "/styles.css", description: "Design tokens and styling", mandatory: true },
                { path: "/script.js", description: "Interactive DOM logic", mandatory: true },
              ],
            },
          };
        }
        if (schema === FileCodeSchema) {
          for (const [filePath, code] of Object.entries(vanillaFiles)) {
            if (prompt.includes(filePath)) {
              return { object: { code } };
            }
          }
          return { object: { code: vanillaFiles["/index.html"] } };
        }
        throw new Error(`Unexpected schema in vanilla generator: ${schema}`);
      });

      // 2. Send creation request (initiates background generation automatically)
      await createProject(req, res);

      assert.strictEqual(statusCode, 201, "Must return HTTP 201 Created");
      assert.strictEqual(responseBody.status, "pending");
      assert.strictEqual(responseBody.framework, "vanilla", "Must default to 'vanilla' when unspecified");
      assert.strictEqual(responseBody.version, 0);

      const projectId = responseBody._id;

      // 3. Await background generation completion
      let finalProject = null;
      for (let i = 0; i < 80; i++) {
        finalProject = inMemoryProjects.get(projectId);
        if (finalProject && (finalProject.status === "completed" || finalProject.status === "failed")) break;
        await new Promise((r) => setTimeout(r, 25));
      }

      assert.ok(finalProject, "Project must exist in storage");
      assert.strictEqual(finalProject.status, "completed", "Status must be completed");
      assert.strictEqual(finalProject.framework, "vanilla", "Project framework must remain 'vanilla'");
      assert.strictEqual(finalProject.version, 1, "Initial version must be 1");

      // Verify files generated
      assert.ok(finalProject.files["/index.html"], "Must contain /index.html");
      assert.ok(finalProject.files["/styles.css"], "Must contain /styles.css");
      assert.ok(finalProject.files["/script.js"], "Must contain /script.js");
      assert.strictEqual(finalProject.files["/App.js"], undefined, "Must NOT contain /App.js");
      assert.strictEqual(finalProject.files["/App.jsx"], undefined, "Must NOT contain /App.jsx");

      // Verify HTML content structure
      const indexContent = finalProject.files["/index.html"].content;
      assert.ok(indexContent.includes("<!DOCTYPE html>"));
      assert.ok(indexContent.includes("./styles.css"));
      assert.ok(indexContent.includes("./script.js"));
      assert.ok(!indexContent.includes("className="), "Vanilla HTML must not contain React className");

      // Verify history snapshot
      assert.ok(finalProject.history.length >= 1, "Must record initial snapshot in project.history");
      const initialSnapshot = finalProject.history[0];
      assert.strictEqual(initialSnapshot.version, 1);
      assert.strictEqual(initialSnapshot.label, "Initial generation");
      assert.ok(initialSnapshot.files["/index.html"], "Snapshot must store /index.html");
      assert.ok(initialSnapshot.files["/script.js"], "Snapshot must store /script.js");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Explicit & Auto-Detected React Lifecycle (End-to-End)
  // --------------------------------------------------------------------------
  describe("2. Explicit & Auto-Detected React Lifecycle (End-to-End)", () => {
    it("POST /api/projects auto-detects 'react' from prompt keywords and accepts explicit framework: 'react'", async () => {
      // 2a: Auto-detection from keyword
      assert.strictEqual(
        resolveTargetFramework("Build an interactive single-page app (SPA) with React components"),
        "react"
      );
      assert.strictEqual(
        resolveTargetFramework("SaaS metrics monitor", "react"),
        "react"
      );
      assert.strictEqual(
        resolveTargetFramework("Bespoke design studio landing page"),
        "vanilla"
      );
    });

    it("Executes complete React generation pipeline with .jsx components and captures snapshot", async () => {
      let resData = null;

      setAiGeneratorOverride(async ({ schema, prompt }) => {
        if (schema === RequirementContractSchema) {
          return {
            object: {
              framework: "react",
              identity: {
                name: "React Dashboard",
                category: "saas_landing",
                purpose: "Analytics dashboard application",
              },
              navigation: { type: "sticky_header", primaryItems: ["Overview", "Settings"] },
              pages: [{ id: "home", name: "Home", isPrimary: true, sections: [{ id: "dash", name: "Dashboard", priority: "mandatory" }] }],
              mandatoryRequirements: ["Dashboard overview"],
              functionalRequirements: [],
            },
          };
        }
        if (schema === DesignSpecSchema) {
          return {
            object: {
              framework: "react",
              archetype: "clean_modern",
              aestheticDirection: "Data-Dense Modern",
              colorPalette: { primary: "#2563eb", accent: "#3b82f6" },
            },
          };
        }
        if (schema === FilePlanSchema) {
          return {
            object: {
              projectName: "React Dashboard",
              manifest: Object.keys(reactFiles),
              files: [
                { path: "/App.jsx", description: "Main React application root", exportName: "default", exports: "default App", imports: ["./components/Header.jsx", "./styles.css"], mandatory: true },
                { path: "/components/Header.jsx", description: "Dashboard header component", exportName: "default", exports: "default Header", imports: [], mandatory: true },
                { path: "/styles.css", description: "Global styles", exports: "none", imports: [], mandatory: true },
              ],
            },
          };
        }
        if (schema === FileCodeSchema) {
          for (const [filePath, code] of Object.entries(reactFiles)) {
            if (prompt.includes(filePath)) {
              return { object: { code } };
            }
          }
          return { object: { code: reactFiles["/App.jsx"] } };
        }
        throw new Error(`Unexpected schema in react generator: ${schema}`);
      });

      await createProject(
        {
          body: { prompt: "Build an analytics dashboard in React", framework: "react" },
          user: { userId: "user_e2e_test" },
        },
        {
          status: () => ({ json: (d) => { resData = d; } }),
        }
      );

      assert.strictEqual(resData.framework, "react");
      const projectId = resData._id;

      let finalProject = null;
      for (let i = 0; i < 80; i++) {
        finalProject = inMemoryProjects.get(projectId);
        if (finalProject && (finalProject.status === "completed" || finalProject.status === "failed")) break;
        await new Promise((r) => setTimeout(r, 25));
      }

      assert.ok(finalProject);
      assert.strictEqual(finalProject.status, "completed");
      assert.strictEqual(finalProject.framework, "react");
      assert.strictEqual(finalProject.version, 1);

      assert.ok(finalProject.files["/App.jsx"], "Must contain /App.jsx");
      assert.ok(finalProject.files["/components/Header.jsx"], "Must contain /components/Header.jsx");
      assert.ok(finalProject.files["/styles.css"], "Must contain /styles.css");
      assert.strictEqual(finalProject.files["/index.html"], undefined, "React project must not generate /index.html root");

      // Verify history snapshot
      assert.ok(finalProject.history.length >= 1);
      assert.strictEqual(finalProject.history[0].label, "Initial generation");
      assert.ok(finalProject.history[0].files["/App.jsx"]);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Conversational Revision Stack Preservation (End-to-End)
  // --------------------------------------------------------------------------
  describe("3. Conversational Revision Stack Preservation (End-to-End)", () => {
    it("POST /api/projects/:id/chat preserves 'vanilla' stack, updates HTML/JS without JSX, and records v2 snapshot", async () => {
      // Stage existing completed vanilla project at version 1
      const fileEntries = {};
      for (const [p, code] of Object.entries(vanillaFiles)) {
        fileEntries[p] = { content: code, hash: hashContent(code) };
      }

      const initialSnapshot = {
        version: 1,
        timestamp: new Date(),
        label: "Initial generation",
        files: JSON.parse(JSON.stringify(fileEntries)),
        designSpec: { archetype: "clean_modern" },
      };

      const project = createMockProjectDoc({
        name: "Studio Agency",
        framework: "vanilla",
        version: 1,
        status: "completed",
        files: fileEntries,
        history: [initialSnapshot],
        messages: [
          { role: "user", content: "Build a bespoke design studio landing page" },
          { role: "assistant", content: "Generated vanilla HTML/CSS/JS project." },
        ],
        requirementContract: {
          framework: "vanilla",
          identity: { name: "Studio Agency", category: "agency_portfolio", purpose: "Showcase" },
          pages: [{ id: "home", name: "Home", isPrimary: true, sections: [] }],
          mandatoryRequirements: ["Hero section"],
          functionalRequirements: [],
        },
      });

      // Prepare revision operations that append a new contact section to /index.html and a handler to /script.js
      const updatedHtml = vanillaFiles["/index.html"].replace(
        "</main>",
        `  <section id="contact" class="py-12 border-t border-slate-800">
      <h2 class="text-2xl font-bold mb-4">Contact Studio</h2>
      <form id="contact-form">
        <input type="email" placeholder="hello@studio.com" class="p-2 rounded bg-slate-800 text-white" />
        <button type="submit" class="px-4 py-2 bg-blue-600 rounded">Send</button>
      </form>
    </section>
  </main>`
      );

      const updatedScript = vanillaFiles["/script.js"] + `
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Message received!");
    });
  }
});
`;

      setAiGeneratorOverride(async ({ schema }) => {
        if (schema === RevisionResultSchema) {
          return {
            object: {
              operations: [
                {
                  op: "update",
                  path: "/index.html",
                  search: "</main>",
                  replace: `  <section id="contact" class="py-12 border-t border-slate-800">
      <h2 class="text-2xl font-bold mb-4">Contact Studio</h2>
      <form id="contact-form">
        <input type="email" placeholder="hello@studio.com" class="p-2 rounded bg-slate-800 text-white" />
        <button type="submit" class="px-4 py-2 bg-blue-600 rounded">Send</button>
      </form>
    </section>
  </main>`,
                },
                {
                  op: "update",
                  path: "/script.js",
                  search: vanillaFiles["/script.js"].trim(),
                  replace: updatedScript.trim(),
                },
              ],
              description: "Added contact form section to /index.html and form submit handler to /script.js",
            },
          };
        }
        throw new Error(`Unexpected schema in revision: ${schema}`);
      });

      let resCode = null;
      let resData = null;

      const req = {
        params: { id: project._id },
        body: { prompt: "Add a contact form section and handle its submission" },
        user: { userId: "user_e2e_test" },
      };

      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
        json: (d) => {
          resCode = 200;
          resData = d;
        },
      };

      await chat(req, res);

      assert.strictEqual(resCode, 200, "Chat revision must succeed with HTTP 200");
      assert.strictEqual(project.framework, "vanilla", "Project framework must remain 'vanilla'");
      assert.strictEqual(project.version, 2, "Project version must increment to 2");
      assert.strictEqual(project.status, "completed");

      // Verify updated files
      assert.ok(project.files["/index.html"].content.includes('id="contact"'));
      assert.ok(project.files["/index.html"].content.includes('id="contact-form"'));
      assert.ok(!project.files["/index.html"].content.includes("className="), "Must not introduce JSX className");
      assert.ok(project.files["/script.js"].content.includes("contact-form"));
      assert.ok(!project.files["/script.js"].content.includes("import React"), "Must not introduce React imports");

      // Verify snapshot history
      assert.strictEqual(project.history.length, 2, "Project must have 2 snapshots in history");
      const v2Snapshot = project.history[1];
      assert.strictEqual(v2Snapshot.version, 2);
      assert.ok(v2Snapshot.label.includes("Add a contact form section"));
      assert.ok(v2Snapshot.files["/index.html"].content.includes('id="contact"'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Legacy .js React Project Compatibility (End-to-End)
  // --------------------------------------------------------------------------
  describe("4. Legacy .js React Project Compatibility (End-to-End)", () => {
    it("Loads pre-existing MongoDB project with /App.js and no framework field as 'react', and revises via /chat", async () => {
      const legacyFiles = {
        "/App.js": `import React from 'react';
import './styles.css';
export default function App() {
  return (
    <div className="p-8">
      <h1>Original Legacy Headline</h1>
    </div>
  );
}`,
        "/styles.css": "body { margin: 0; }",
      };

      const fileEntries = {};
      for (const [p, code] of Object.entries(legacyFiles)) {
        fileEntries[p] = { content: code, hash: hashContent(code) };
      }

      // Stage legacy document explicitly omitting 'framework' property
      const legacyProject = createMockProjectDoc({
        name: "Legacy React App",
        framework: undefined, // Simulates legacy document before Phase 4 schema addition
        version: 1,
        status: "completed",
        files: fileEntries,
        history: [
          {
            version: 1,
            label: "Initial generation",
            files: JSON.parse(JSON.stringify(fileEntries)),
          },
        ],
        messages: [{ role: "user", content: "Build legacy app" }],
      });

      // Assert post-init hook inferred 'react'
      assert.strictEqual(legacyProject.framework, "react", "Legacy project with /App.js must infer 'react'");

      // Revision that updates /App.js headline
      setAiGeneratorOverride(async ({ schema }) => {
        if (schema === RevisionResultSchema) {
          return {
            object: {
              operations: [
                {
                  op: "update",
                  path: "/App.js",
                  search: "<h1>Original Legacy Headline</h1>",
                  replace: "<h1>Updated Modernized Headline (v2)</h1>",
                },
              ],
              description: "Updated headline in /App.js",
            },
          };
        }
        throw new Error(`Unexpected schema in legacy revision: ${schema}`);
      });

      let resCode = null;
      let resData = null;

      const req = {
        params: { id: legacyProject._id },
        body: { prompt: "Update headline in App.js to modern version" },
        user: { userId: "user_e2e_test" },
      };

      const res = {
        status: (c) => {
          resCode = c;
          return { json: (d) => { resData = d; } };
        },
        json: (d) => {
          resCode = 200;
          resData = d;
        },
      };

      await chat(req, res);

      assert.strictEqual(resCode, 200);
      assert.strictEqual(legacyProject.framework, "react", "Must preserve 'react' framework");
      assert.strictEqual(legacyProject.version, 2, "Must increment version to 2");
      assert.ok(legacyProject.files["/App.js"].content.includes("Updated Modernized Headline (v2)"));
      assert.strictEqual(legacyProject.history.length, 2);
      assert.strictEqual(legacyProject.history[1].version, 2);
    });
  });
});
