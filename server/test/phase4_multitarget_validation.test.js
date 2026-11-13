import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateProject,
  verifyProjectRuntime,
  validateAndFixCode,
  inferFramework,
  resolveModuleCandidate,
} from "../services/codeValidator.js";

import {
  analyzeFileCode,
  verifyProjectRequirements,
} from "../services/requirementVerification.js";

import {
  createRepairPlan,
  evaluateRepairCandidate,
} from "../services/selfRepair.js";

import {
  analyzeProjectVisualQuality,
  runStaticVisualQa,
} from "../services/visualQa.js";

import { createDefaultRequirementContract } from "../services/requirementContract.js";

describe("Phase 4.2: Dual-Stack Code Validation, Requirement Verification, and Self-Repair Suite", () => {
  // --------------------------------------------------------------------------
  // 1. Framework Inference & Module Candidate Resolution
  // --------------------------------------------------------------------------
  describe("1. Framework Inference & Module Resolution", () => {
    it("infers 'vanilla' when /index.html exists and no React App entry exists", () => {
      const files = {
        "/index.html": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('vanilla');",
      };
      assert.equal(inferFramework(files), "vanilla");
    });

    it("infers 'react' when /App.jsx or /App.js exists", () => {
      const reactFiles1 = {
        "/App.jsx": "import React from 'react'; export default function App() { return <h1>App</h1>; }",
        "/styles.css": "body { margin: 0; }",
      };
      assert.equal(inferFramework(reactFiles1), "react");

      const reactFiles2 = {
        "/App.js": "import React from 'react'; export default function App() { return <h1>App</h1>; }",
        "/styles.css": "body { margin: 0; }",
      };
      assert.equal(inferFramework(reactFiles2), "react");
    });

    it("respects explicitFramework argument when provided", () => {
      assert.equal(inferFramework({}, "vanilla"), "vanilla");
      assert.equal(inferFramework({}, "react"), "react");
    });

    it("resolves extensionless candidate paths to .jsx, .js, and index files", () => {
      const available = [
        "/components/Hero.jsx",
        "/components/Footer.js",
        "/components/Nav/index.jsx",
        "/styles.css",
      ];
      assert.equal(resolveModuleCandidate("/", "./components/Hero", available), "/components/Hero.jsx");
      assert.equal(resolveModuleCandidate("/", "./components/Footer", available), "/components/Footer.js");
      assert.equal(resolveModuleCandidate("/", "./components/Nav", available), "/components/Nav/index.jsx");
      assert.equal(resolveModuleCandidate("/components", "./Hero", available), "/components/Hero.jsx");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Vanilla Project Validation & Runtime Verification
  // --------------------------------------------------------------------------
  describe("2. Vanilla Project Validation & Runtime Verification", () => {
    it("accepts and passes a valid, complete vanilla project", async () => {
      const files = {
        "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Portfolio</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <button id="cta-btn">Click</button>
  </div>
  <script src="./script.js"></script>
</body>
</html>`,
        "/styles.css": "body { margin: 0; background: #fff; } .container { padding: 1rem; }",
        "/script.js": "document.addEventListener('DOMContentLoaded', () => { console.log('Ready'); });",
      };

      const val = validateProject(files, ["/index.html", "/styles.css", "/script.js"], "vanilla");
      assert.equal(val.valid, true);
      assert.equal(val.errors.length, 0);

      const runt = await verifyProjectRuntime(files, "vanilla");
      assert.equal(runt.valid, true);
      assert.equal(runt.errors.length, 0);
    });

    it("detects missing mandatory /index.html entry point in vanilla mode", async () => {
      const files = {
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('No HTML');",
      };

      const val = validateProject(files, ["/index.html"], "vanilla");
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.type === "missing_file" && e.file === "/index.html"));

      const runt = await verifyProjectRuntime(files, "vanilla");
      assert.equal(runt.valid, false);
      assert.ok(runt.errors.some((e) => e.type === "runtime_exception" && e.file === "/index.html"));
    });

    it("detects unresolvable local assets linked in /index.html", async () => {
      const files = {
        "/index.html": `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="./missing-styles.css">
</head>
<body>
  <h1>Test</h1>
  <script src="./missing-script.js"></script>
</body>
</html>`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(files, ["/index.html"], "vanilla");
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.message.includes("missing-styles.css")));
      assert.ok(val.errors.some((e) => e.message.includes("missing-script.js")));

      const runt = await verifyProjectRuntime(files, "vanilla");
      assert.equal(runt.valid, false);
      assert.ok(runt.errors.some((e) => e.message.includes("missing-styles.css")));
    });

    it("flags accidental React/JSX syntax inside vanilla HTML and JavaScript", () => {
      const files = {
        "/index.html": `<!DOCTYPE html>
<html>
<body>
  <div className="broken-react-prop">Hello</div>
</body>
</html>`,
        "/styles.css": "body { margin: 0; }",
        "/script.js": "import React from 'react';\nconst el = <button>Click</button>;",
      };

      const val = validateProject(files, ["/index.html", "/styles.css", "/script.js"], "vanilla");
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.file === "/index.html" && e.message.includes("className=")));
      assert.ok(val.errors.some((e) => e.file === "/script.js" && e.message.includes("Accidental React import")));
      assert.ok(val.errors.some((e) => e.file === "/script.js" && e.message.includes("Raw JSX syntax")));
    });

    it("flags unbalanced CSS braces in /styles.css", async () => {
      const files = {
        "/index.html": "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
        "/styles.css": "body { margin: 0; .broken { color: red; }", // Missing closing brace for body
        "/script.js": "console.log('ok');",
      };

      const val = validateProject(files, ["/index.html", "/styles.css"], "vanilla");
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.file === "/styles.css" && e.message.includes("Unbalanced CSS braces")));

      const runt = await verifyProjectRuntime(files, "vanilla");
      assert.equal(runt.valid, false);
      assert.ok(runt.errors.some((e) => e.file === "/styles.css" && e.message.includes("Unbalanced CSS braces")));
    });

    it("does not demand default exports or React imports on vanilla JavaScript files", () => {
      const vanillaJs = "function init() { console.log('Initialized'); }\ninit();";
      const result = validateAndFixCode(vanillaJs, "/script.js", { framework: "vanilla" });
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(!result.code.includes("export default"));
      assert.ok(!result.code.includes("import React"));
    });
  });

  // --------------------------------------------------------------------------
  // 3. React (.jsx and legacy .js) Project Validation & Runtime Verification
  // --------------------------------------------------------------------------
  describe("3. React Project Validation & Runtime Verification", () => {
    it("validates a modern React project using .jsx extensions and extensionless imports", async () => {
      const files = {
        "/App.jsx": `import React from 'react';
import './styles.css';
import Hero from './components/Hero';
export default function App() {
  return (
    <main>
      <Hero />
    </main>
  );
}`,
        "/components/Hero.jsx": `import React from 'react';
export default function Hero() {
  return <h1>Hero Headline</h1>;
}`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(files, ["/App.jsx", "/components/Hero.jsx", "/styles.css"], "react");
      assert.equal(val.valid, true);
      assert.equal(val.errors.length, 0);

      const runt = await verifyProjectRuntime(files, "react");
      assert.equal(runt.valid, true);
      assert.equal(runt.errors.length, 0);
    });

    it("maintains 100% backward compatibility for legacy React projects with /App.js", async () => {
      const files = {
        "/App.js": `import React from 'react';
import './styles.css';
export default function App() {
  return <h1>Legacy App</h1>;
}`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(files, ["/App.js", "/styles.css"]);
      assert.equal(val.valid, true);
      assert.equal(val.errors.length, 0);

      const runt = await verifyProjectRuntime(files);
      assert.equal(runt.valid, true);
      assert.equal(runt.errors.length, 0);
    });

    it("detects contract violations when importing default from module with no default export", () => {
      const files = {
        "/App.jsx": `import React from 'react';
import Hero from './components/Hero';
export default function App() { return <Hero />; }`,
        "/components/Hero.jsx": `import React from 'react';
export function NamedHero() { return <h1>Named</h1>; }`, // No default export
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(files, ["/App.jsx", "/components/Hero.jsx"], "react");
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.type === "contract" && e.message.includes("has no default export")));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Requirement Verification on Vanilla Projects
  // --------------------------------------------------------------------------
  describe("4. Requirement Verification on Vanilla Projects", () => {
    it("extracts HTML elements and classes cleanly in analyzeFileCode without parse errors", async () => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head><link rel="stylesheet" href="./styles.css"></head>
<body>
  <nav class="main-nav flex justify-between">
    <a href="#home">Home</a>
    <a href="#about">About</a>
  </nav>
  <form id="contact-form" class="space-y-4" onsubmit="handleSubmit(event)">
    <input type="search" name="q" placeholder="Search catalog..." />
    <button type="submit">Send</button>
  </form>
</body>
</html>`;

      const analysis = await analyzeFileCode("/index.html", html);
      assert.equal(analysis.hasParseError, false);
      assert.ok(analysis.jsxElements.some((el) => el.tag === "nav"));
      assert.ok(analysis.jsxElements.some((el) => el.tag === "form"));
      assert.ok(analysis.jsxElements.some((el) => el.tag === "input" && el.attributes.type === "search"));
      assert.ok(analysis.cssClasses.has("main-nav"));
      assert.ok(analysis.cssClasses.has("#contact-form"));
      assert.ok(analysis.eventHandlers.includes("submit"));
    });

    it("verifies mandatory requirements for a vanilla project", async () => {
      const contract = createDefaultRequirementContract("Modern portfolio landing page", "vanilla");
      const files = {
        "/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="./styles.css">
</head>
<body class="bg-slate-900 text-white">
  <header class="p-6">
    <nav class="flex justify-between items-center">
      <div class="logo font-bold">Studio</div>
      <div class="hidden md:flex space-x-4">
        <a href="#features">Work</a>
        <a href="#cta">Contact</a>
      </div>
    </nav>
  </header>
  <main>
    <section id="hero" class="py-20 text-center">
      <h1 class="text-5xl font-extrabold">Creative Studio</h1>
      <p class="mt-4 text-slate-400">Impactful hero with value proposition and primary CTA.</p>
      <button class="px-6 py-3 bg-indigo-600 rounded">View Works</button>
    </section>
    <section id="features" class="py-16 px-6">
      <h2 class="text-3xl font-bold">Selected Works & Projects</h2>
      <p>Structured features presentation and project showcase.</p>
      <div class="tabs mt-4">
        <button onclick="toggleTab(0)" class="tab-btn active">Websites</button>
        <button onclick="toggleTab(1)" class="tab-btn">Apps</button>
        <div id="tab-content" class="tab-pane active p-4">Feature Showcase Content</div>
      </div>
    </section>
    <section id="cta" class="py-16 px-6 text-center">
      <h2 class="text-3xl font-bold">Closing Call to Action</h2>
      <p class="mt-2">Let's collaborate on your next digital experience.</p>
      <button class="mt-4 px-6 py-3 bg-blue-600 rounded">Let's Collaborate</button>
    </section>
  </main>
  <footer class="p-6 border-t border-slate-800 text-center">
    <nav class="footer-nav space-x-4">
      <a href="#privacy">Legal Privacy</a>
      <a href="#social">Social Links</a>
    </nav>
  </footer>
  <script src="./script.js"></script>
</body>
</html>`,
        "/styles.css": `
body { margin: 0; background-color: #0f172a; color: #fff; }
.tab-pane { display: none; }
.tab-pane.active { display: block; }
`,
        "/script.js": `
function toggleTab(index) {
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach((p, idx) => {
    p.classList.toggle('active', idx === index);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portfolio ready');
});
`,
      };

      const summary = await verifyProjectRequirements(files, contract, null, { framework: "vanilla" });
      assert.ok(summary);
      assert.ok(summary.totalRequirements > 0);
      assert.ok(summary.passed > 0);
      assert.equal(summary.mandatoryFailed, 0);
      assert.ok(summary.mandatoryPassed > 0);
      assert.notEqual(summary.overallStatus, "FAILED");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Self-Repair & Visual QA on Dual-Stack Projects
  // --------------------------------------------------------------------------
  describe("5. Self-Repair and Visual QA on Dual-Stack Projects", () => {
    it("createRepairPlan targets vanilla files and sets vanilla constraints", () => {
      const files = {
        "/index.html": "<!DOCTYPE html><html><body><h1>Site</h1></body></html>",
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('init');",
      };

      const failures = [
        {
          id: "fail_1",
          category: "REQUIREMENT_FAIL",
          requirementId: "search_filter",
          requirementDescription: "Search input filtering",
          diagnosticExplanation: "Search filter behavior missing",
          affectedFiles: ["/script.js"],
          severity: "high",
          repairabilityClassification: "REPAIRABLE",
        },
      ];

      const plan = createRepairPlan(failures, files, null, { framework: "vanilla" });
      assert.equal(plan.tasks.length, 1);
      assert.equal(plan.tasks[0].targetFile, "/script.js");
      assert.ok(plan.tasks[0].constraints.some((c) => c.includes("without React imports or JSX syntax")));
    });

    it("evaluateRepairCandidate evaluates and accepts valid vanilla repair candidate", async () => {
      const originalFiles = {
        "/index.html": "<!DOCTYPE html><html><body><h1>Original</h1></body></html>",
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('original');",
      };

      const candidateFiles = {
        "/index.html": "<!DOCTYPE html><html><body><h1>Repaired</h1></body></html>",
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('repaired');",
      };

      const origVerification = {
        overallStatus: "FAILED",
        mandatoryFailed: 1,
        mandatoryPassed: 0,
        passed: 0,
        requirements: [
          { requirementId: "req_1", priority: "mandatory", status: "FAIL" },
        ],
      };

      const contract = createDefaultRequirementContract("Simple website", "vanilla");

      const evalResult = await evaluateRepairCandidate({
        candidateFiles,
        originalFiles,
        originalVerification: origVerification,
        requirementContract: contract,
      });

      assert.ok(evalResult);
    });

    it("runStaticVisualQa evaluates vanilla and react files according to framework", () => {
      const vanillaFiles = {
        "/index.html": '<!DOCTYPE html><html><body><div class="w-[2000px]">Overflow</div></body></html>',
        "/styles.css": "body { margin: 0; }",
        "/script.js": "console.log('test');",
      };

      const qaVanilla = runStaticVisualQa(vanillaFiles, null, "vanilla");
      assert.ok(qaVanilla.issues.length > 0);
      assert.ok(qaVanilla.issues.some((i) => i.category === "overflow" && i.file === "/index.html"));

      const reactFiles = {
        "/App.jsx": 'import React from "react"; export default function App() { return <div className="w-[2000px]">Overflow</div>; }',
        "/styles.css": "body { margin: 0; }",
      };

      const qaReact = runStaticVisualQa(reactFiles, null, "react");
      assert.ok(qaReact.issues.length > 0);
      assert.ok(qaReact.issues.some((i) => i.category === "overflow" && i.file === "/App.jsx"));
    });
  });
});
