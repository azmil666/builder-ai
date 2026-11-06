import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFailures,
  createRepairPlan,
  generateTargetedRepairForTask,
  evaluateRepairCandidate,
  runEvidenceDrivenSelfRepairLoop,
} from "../services/selfRepair.js";
import {
  FileCodeSchema,
  SelfRepairReportSchema,
} from "../services/aiSchemas.js";
import { setAiGeneratorOverride, resetAiGeneratorOverride } from "../services/ai.js";

describe("Phase 4: Evidence-Driven Targeted Self-Repair Loop Suite", () => {
  afterEach(() => {
    resetAiGeneratorOverride();
  });

  // Base fixtures
  const sampleContract = {
    contractVersion: "2.0.0",
    appName: "Modern Portfolio",
    category: "portfolio",
    purpose: "Showcase creative work and contact information",
    identity: {
      name: "Modern Portfolio",
      category: "portfolio",
      purpose: "Showcase creative work and contact information",
    },
    pages: [
      {
        id: "home",
        name: "Home",
        isPrimary: true,
        sections: [
          { id: "hero", name: "Hero", priority: "mandatory" },
          { id: "contact", name: "Contact", priority: "mandatory" },
        ],
      },
    ],
    functionalRequirements: [
      {
        id: "contact_form",
        name: "Contact Form",
        priority: "mandatory",
        implementationTarget: "/components/Contact.js",
      },
    ],
    mandatoryRequirements: [
      "Hero section with creative title and call to action",
      "Contact inquiry form with message submission",
    ],
    optionalRequirements: [],
    unverifiableRequirements: [
      {
        id: "unverifiable_crm_sync",
        category: "integration",
        priority: "optional",
        description: "Sync contact inquiries with external HubSpot CRM",
        acceptanceCriteria: ["External webhook sync"],
        verificationEvidenceNeeded: ["external_api_call"],
        mappedFiles: [],
      },
    ],
    design: {
      colorPreferences: { theme: "light" },
    },
    designGuardrails: {
      themeMode: "light",
      responsiveBreakpoints: ["mobile", "desktop"],
      bannedAITells: ["Lorem Ipsum"],
      typographyScale: "modern",
      colorPalette: { primary: "#000000" },
    },
    verificationChecklist: [],
    schemaVersion: "2.0.0",
  };

  const sampleFilePlan = {
    files: [
      { path: "/App.js", purpose: "Main application root", exportName: "default" },
      { path: "/components/Hero.js", purpose: "Hero section", exportName: "default" },
      { path: "/components/Contact.js", purpose: "Contact form", exportName: "default" },
      { path: "/styles.css", purpose: "Global CSS", exportName: null },
    ],
  };

  const baseCleanFiles = {
    "/package.json": JSON.stringify(
      {
        name: "builder-ai-project",
        version: "1.0.0",
        private: true,
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
      },
      null,
      2
    ),
    "/App.js": `
      import React from 'react';
      import Hero from './components/Hero.js';
      import Contact from './components/Contact.js';
      import './styles.css';
      export default function App() {
        return (
          <main className="min-h-screen bg-white md:px-12">
            <nav className="flex justify-between p-4">
              <span className="font-bold">Portfolio</span>
              <div className="hidden md:flex space-x-4">
                <a href="#hero">Home</a>
                <a href="#contact">Contact</a>
              </div>
              <button className="md:hidden">Menu</button>
            </nav>
            <Hero />
            <Contact />
          </main>
        );
      }
    `,
    "/styles.css": "body { margin: 0; background: #ffffff; color: #18181b; }",
    "/components/Hero.js": `
      import React from 'react';
      export default function Hero() {
        return (
          <section className="py-20 md:py-32 text-center">
            <h1 className="text-4xl md:text-6xl font-bold">Portfolio</h1>
            <p className="mt-4 text-gray-600">Welcome to our creative showcase</p>
            <button className="mt-6 px-6 py-2 bg-black text-white rounded">Explore</button>
          </section>
        );
      }
    `,
    "/components/Contact.js": `
      import React, { useState } from 'react';
      export default function Contact() {
        const [sent, setSent] = useState(false);
        const handleSubmit = (e) => {
          e.preventDefault();
          setSent(true);
        };
        return (
          <section className="py-12 md:py-20">
            <h2 className="text-2xl font-bold">Contact Us</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Name" required className="border p-2" />
              <button type="submit" className="px-4 py-2 bg-black text-white rounded">Send Message</button>
            </form>
            {sent && <p>Message sent successfully!</p>}
          </section>
        );
      }
    `,
  };

  // --------------------------------------------------------------------------
  // Scenario 1: Mandatory failed requirement repaired successfully
  // --------------------------------------------------------------------------
  it("1. Mandatory failed requirement is repaired successfully and accepted", async () => {
    // Missing contact form initially
    const initialFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <div>Work in progress</div>;
        }
      `,
    };

    // AI generator returns properly repaired Contact.js with form and onSubmit handler
    setAiGeneratorOverride(async ({ prompt, system }) => {
      return {
        object: {
          path: "/components/Contact.js",
          code: `
            import React, { useState } from 'react';
            export default function Contact() {
              const [sent, setSent] = useState(false);
              const handleSubmit = (e) => {
                e.preventDefault();
                setSent(true);
              };
              return (
                <section className="py-12 md:py-20">
                  <h2 className="text-2xl font-bold">Contact Us</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Name" required className="border p-2" />
                    <button type="submit" className="px-4 py-2 bg-black text-white rounded">Send Message</button>
                  </form>
                  {sent && <p>Success!</p>}
                </section>
              );
            }
          `,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: initialFiles,
      prompt: "Create a portfolio with hero and contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.repairTriggered, true);
    assert.strictEqual(result.report.accepted, true);
    assert.strictEqual(result.verification.mandatoryFailed, 0);
    assert.ok(result.files["/components/Contact.js"].includes("onSubmit={handleSubmit}"));
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Partial requirement repaired successfully
  // --------------------------------------------------------------------------
  it("2. Partial requirement is identified, repaired, and transitions to PASS", async () => {
    // Contact component has form element but no submit handler
    const initialFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return (
            <section className="py-12 md:py-20">
              <h2 className="text-2xl font-bold">Contact Us</h2>
              <form className="space-y-4">
                <input type="text" placeholder="Your name" className="border p-2" />
                <button type="button" className="px-4 py-2 bg-black text-white rounded">Submit</button>
              </form>
            </section>
          );
        }
      `,
    };

    setAiGeneratorOverride(async () => {
      return {
        object: {
          path: "/components/Contact.js",
          code: `
            import React, { useState } from 'react';
            export default function Contact() {
              const [submitted, setSubmitted] = useState(false);
              const handleSubmit = (e) => {
                e.preventDefault();
                setSubmitted(true);
              };
              return (
                <section className="py-12 md:py-20">
                  <h2 className="text-2xl font-bold">Contact Us</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Your name" required className="border p-2" />
                    <button type="submit" className="px-4 py-2 bg-black text-white rounded">Submit</button>
                  </form>
                  {submitted && <p>Submitted!</p>}
                </section>
              );
            }
          `,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: initialFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.accepted, true);
    assert.ok(result.files["/components/Contact.js"].includes("onSubmit={handleSubmit}"));
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Repair introduces a regression (rejected, rollback preserves original)
  // --------------------------------------------------------------------------
  it("3. Repair introducing regression is rejected and rolled back to original files", async () => {
    const initialFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <div>Incomplete Contact</div>;
        }
      `,
    };

    // Candidate breaks Hero completely
    const regressingCandidateFiles = {
      ...initialFiles,
      "/components/Hero.js": `
        import React from 'react';
        export default function Hero() {
          return <div className="py-4">Empty</div>;
        }
      `,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <form onSubmit={(e) => e.preventDefault()}><button>Send</button></form>;
        }
      `,
    };

    const evalResult = await evaluateRepairCandidate({
      candidateFiles: regressingCandidateFiles,
      originalFiles: initialFiles,
      originalVerification: {
        overallStatus: "PARTIALLY_VERIFIED",
        passed: 1,
        requirements: [
          { requirementId: "mandatory_req_0", priority: "mandatory", status: "PASS", requirementText: "Hero section" },
          { requirementId: "section_contact", priority: "mandatory", status: "FAIL", requirementText: "Contact section" },
        ],
      },
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
    });

    assert.strictEqual(evalResult.accepted, false);
    assert.ok(evalResult.reason.includes("breaks previously passing mandatory requirement"));
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Repair fails syntax validation (rejected, rollback)
  // --------------------------------------------------------------------------
  it("4. Repair failing syntax validation is rejected and rolled back", async () => {
    const initialFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <div>Contact placeholder</div>;
        }
      `,
    };

    // AI generator returns invalid JSX syntax
    setAiGeneratorOverride(async () => {
      return {
        object: {
          path: "/components/Contact.js",
          code: `
            export default function Contact() {
              return (
                <section>
                  <form onSubmit={() => {}}>
                    <input type="text"
                    {/* Unclosed tags and syntax error */}
              );
            }
          `,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: initialFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 1,
    });

    assert.strictEqual(result.report.accepted, false);
    assert.strictEqual(result.report.rollbackPerformed, true);
    // Original files retained
    assert.strictEqual(result.files["/components/Contact.js"], initialFiles["/components/Contact.js"]);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Unverifiable requirement must not be falsely passed
  // --------------------------------------------------------------------------
  it("5. Unverifiable requirement is marked UNREPAIRABLE_UNVERIFIABLE and not blindly passed", () => {
    const fakeVerification = {
      overallStatus: "PARTIALLY_VERIFIED",
      passed: 1,
      mandatoryFailed: 0,
      requirements: [
        {
          requirementId: "unverifiable_crm_sync",
          description: "Sync contact inquiries with external HubSpot CRM",
          category: "integration",
          priority: "optional",
          status: "UNVERIFIABLE",
          confidenceScore: 0.2,
          evidence: [],
          missingEvidence: ["No AST pattern can verify live external CRM sync"],
          affectedFiles: [],
        },
      ],
    };

    const failures = classifyFailures({
      verificationSummary: fakeVerification,
      validationErrors: [],
      runtimeErrors: [],
      files: baseCleanFiles,
    });

    const unverifiable = failures.find((f) => f.requirementId === "unverifiable_crm_sync");
    assert.ok(unverifiable, "Unverifiable requirement must be classified");
    assert.strictEqual(unverifiable.category, "REQUIREMENT_UNVERIFIABLE");
    assert.strictEqual(unverifiable.repairabilityClassification, "UNREPAIRABLE_UNVERIFIABLE");

    // Repair plan must NOT schedule tasks for unrepairable unverifiable items
    const plan = createRepairPlan([unverifiable], baseCleanFiles, sampleFilePlan, sampleContract, null);
    assert.strictEqual(plan.tasks.length, 0, "No repair task should be generated for unverifiable items");
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Repair that changes unrelated files is prevented or constrained
  // --------------------------------------------------------------------------
  it("6. Repair plan isolates tasks to affected files only without touching unrelated files", () => {
    const failures = [
      {
        id: "fail_contact",
        category: "REQUIREMENT_FAIL",
        requirementId: "section_contact",
        requirementDescription: "Missing contact form",
        severity: "critical",
        evidence: [],
        missingEvidence: ["Missing onSubmit"],
        affectedFiles: ["/components/Contact.js"],
        repairabilityClassification: "REPAIRABLE",
      },
    ];

    const plan = createRepairPlan(failures, baseCleanFiles, sampleFilePlan, sampleContract, null);

    assert.strictEqual(plan.tasks.length, 1);
    assert.strictEqual(plan.tasks[0].targetFile, "/components/Contact.js");
    // Assert other files like Hero.js and styles.css are not targeted
    const targets = plan.tasks.map((t) => t.targetFile);
    assert.ok(!targets.includes("/components/Hero.js"));
    assert.ok(!targets.includes("/styles.css"));
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Multiple failures repaired in a batch (grouped by file)
  // --------------------------------------------------------------------------
  it("7. Multiple failures on the same file are grouped into a single repair task", () => {
    const multipleFailures = [
      {
        id: "fail_contact_form",
        category: "REQUIREMENT_FAIL",
        requirementId: "section_contact",
        requirementDescription: "Missing form submission",
        severity: "critical",
        affectedFiles: ["/components/Contact.js"],
        missingEvidence: ["Missing onSubmit"],
        repairabilityClassification: "REPAIRABLE",
      },
      {
        id: "fail_contact_input",
        category: "REQUIREMENT_PARTIAL",
        requirementId: "section_contact_fields",
        requirementDescription: "Missing email input field",
        severity: "high",
        affectedFiles: ["/components/Contact.js"],
        missingEvidence: ["Missing email input"],
        repairabilityClassification: "REPAIRABLE",
      },
    ];

    const plan = createRepairPlan(multipleFailures, baseCleanFiles, sampleFilePlan, sampleContract, null);

    // Grouping by affected file ensures exactly 1 task for /components/Contact.js
    assert.strictEqual(plan.tasks.length, 1);
    assert.strictEqual(plan.tasks[0].targetFile, "/components/Contact.js");
    assert.strictEqual(plan.tasks[0].failureIds.length, 2);
    assert.ok(plan.tasks[0].expectedBehavior.includes("Missing form submission"));
    assert.ok(plan.tasks[0].expectedBehavior.includes("Missing email input field"));
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Retry exhaustion (bounded by maxAttempts, retains best known files)
  // --------------------------------------------------------------------------
  it("8. Retry exhaustion halts strictly at maxAttempts and retains best known files", async () => {
    const brokenFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `export default function Contact() { return <div>Broken</div>; }`,
    };

    let attemptCount = 0;
    setAiGeneratorOverride(async () => {
      attemptCount++;
      return {
        object: {
          path: "/components/Contact.js",
          // Still missing required form and handler
          code: `export default function Contact() { return <div>Still broken attempt ${attemptCount}</div>; }`,
        },
      };
    });

    let exhaustedCalled = false;
    const callbacks = {
      onRepairExhausted: () => {
        exhaustedCalled = true;
      },
    };

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: brokenFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      callbacks,
      maxAttempts: 2,
    });

    assert.strictEqual(result.report.accepted, false);
    assert.ok(result.report.attemptCount >= 1 && result.report.attemptCount <= 2);
    assert.strictEqual(exhaustedCalled, true);
    assert.ok(result.files["/components/Hero.js"]);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Rollback preserving original project
  // --------------------------------------------------------------------------
  it("9. Rollback strictly preserves all original files when repair fails", async () => {
    const originalFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `export default function Contact() { return <div>Original Contact Stub</div>; }`,
    };

    setAiGeneratorOverride(async () => {
      return {
        object: {
          path: "/components/Contact.js",
          code: `export default function Contact() { return <div>Invalid Repair Stub</div>; }`,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: originalFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 1,
    });

    assert.strictEqual(result.report.accepted, false);
    assert.strictEqual(result.report.rollbackPerformed, true);
    assert.deepStrictEqual(result.files, originalFiles);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Revision repair preserving existing contract
  // --------------------------------------------------------------------------
  it("10. Revision repair preserves existing contract items while repairing revision additions", async () => {
    const revisionContract = {
      ...sampleContract,
      pages: [
        {
          id: "home",
          name: "Home",
          isPrimary: true,
          sections: [
            { id: "hero", name: "Hero", priority: "mandatory" },
            { id: "contact", name: "Contact", priority: "mandatory" },
            { id: "faq", name: "FAQ", priority: "mandatory" },
          ],
        },
      ],
      mandatoryRequirements: [
        ...sampleContract.mandatoryRequirements,
        "FAQ accordion section with questions and answers",
      ],
    };

    const revisionPlan = {
      files: [
        ...sampleFilePlan.files,
        { path: "/components/FAQ.js", purpose: "FAQ accordion", exportName: "default" },
      ],
    };

    const initialRevisionFiles = {
      ...baseCleanFiles,
      "/components/FAQ.js": `export default function FAQ() { return <div>FAQ Stub</div>; }`,
    };

    setAiGeneratorOverride(async ({ prompt, system }) => {
      return {
        object: {
          path: "/components/FAQ.js",
          code: `
            import React, { useState } from 'react';
            export default function FAQ() {
              const [open, setOpen] = useState(false);
              return (
                <section className="py-12 md:py-20">
                  <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
                  <div>
                    <button onClick={() => setOpen(!open)} className="text-left font-semibold">What services do you offer?</button>
                    {open && <p className="mt-2 text-gray-600">Web development and modern UI design.</p>}
                  </div>
                </section>
              );
            }
          `,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: initialRevisionFiles,
      prompt: "Add an FAQ accordion to the portfolio",
      requirementContract: revisionContract,
      filePlan: revisionPlan,
      maxAttempts: 2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.accepted, true);
    // Verified Hero, Contact, and new FAQ are all intact
    assert.ok(result.files["/components/Hero.js"].includes("Portfolio"));
    assert.ok(result.files["/components/Contact.js"].includes("Contact Us"));
    assert.ok(result.files["/components/FAQ.js"].includes("Frequently Asked Questions"));
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Gemini/OpenRouter structured output compatibility
  // --------------------------------------------------------------------------
  it("11. Targeted repair uses generateStructuredObject with FileCodeSchema and mock compatibility", async () => {
    let schemaReceived = null;
    let systemReceived = null;

    setAiGeneratorOverride(async ({ schema, system, prompt }) => {
      schemaReceived = schema;
      systemReceived = system;
      return {
        object: {
          path: "/components/Hero.js",
          code: `
            import React from 'react';
            export default function Hero() {
              return (
                <section className="py-20 md:py-32 text-center">
                  <h1 className="text-4xl md:text-6xl font-bold">Portfolio</h1>
                  <p className="mt-4 text-gray-600">Welcome</p>
                  <button className="mt-6 px-6 py-2 bg-black text-white rounded">Explore</button>
                </section>
              );
            }
          `,
        },
      };
    });

    const task = {
      taskId: "repair_hero_1",
      targetFile: "/components/Hero.js",
      failureCategory: "REQUIREMENT_FAIL",
      failureIds: ["fail_1"],
      instructions: "Ensure Hero has heading with title and CTA button",
      diagnostics: ["Missing CTA button"],
    };

    const repairOutput = await generateTargetedRepairForTask({
      task,
      currentFiles: baseCleanFiles,
      prompt: "Create portfolio",
      requirementContract: sampleContract,
      designSpec: null,
      filePlan: sampleFilePlan,
    });

    assert.ok(repairOutput);
    assert.strictEqual(repairOutput.path, "/components/Hero.js");
    assert.ok(repairOutput.code.includes("Portfolio"));
    assert.strictEqual(schemaReceived, FileCodeSchema);
    assert.ok(systemReceived.includes("React"));
  });

  // --------------------------------------------------------------------------
  // Scenario 12: SSE progress events emitted in order
  // --------------------------------------------------------------------------
  it("12. SSE progress events are emitted in strict expected sequence", async () => {
    const initialFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `export default function Contact() { return <div>Contact placeholder</div>; }`,
    };

    setAiGeneratorOverride(async () => {
      return {
        object: {
          path: "/components/Contact.js",
          code: `
            import React, { useState } from 'react';
            export default function Contact() {
              const [sent, setSent] = useState(false);
              const handleSubmit = (e) => {
                e.preventDefault();
                setSent(true);
              };
              return (
                <section className="py-12 md:py-20">
                  <h2 className="text-2xl font-bold">Contact Us</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Name" required className="border p-2" />
                    <button type="submit" className="px-4 py-2 bg-black text-white rounded">Send</button>
                  </form>
                  {sent && <p>Done</p>}
                </section>
              );
            }
          `,
        },
      };
    });

    const events = [];
    const callbacks = {
      onRepairStarted: () => events.push("repair_started"),
      onRepairPlanCreated: () => events.push("repair_plan_created"),
      onRepairAttemptStarted: () => events.push("repair_attempt_started"),
      onRepairCandidateVerified: () => events.push("repair_candidate_verified"),
      onRepairCompleted: () => events.push("repair_completed"),
    };

    await runEvidenceDrivenSelfRepairLoop({
      files: initialFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      callbacks,
      maxAttempts: 2,
    });

    assert.deepStrictEqual(events, [
      "repair_started",
      "repair_plan_created",
      "repair_attempt_started",
      "repair_candidate_verified",
      "repair_completed",
    ]);
  });

  // --------------------------------------------------------------------------
  // Scenario 13: No repair required when all mandatory requirements pass
  // --------------------------------------------------------------------------
  it("13. No repair is triggered when all mandatory requirements pass initially", async () => {
    let aiCalled = false;
    setAiGeneratorOverride(async () => {
      aiCalled = true;
      return { object: { path: "/App.js", code: "" } };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: baseCleanFiles,
      prompt: "Create portfolio with hero and contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.report.repairTriggered, false);
    assert.strictEqual(result.report.attemptCount, 0);
    assert.strictEqual(aiCalled, false, "AI must not be called when code is already verified");
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Candidate improves one requirement but breaks another (rejected)
  // --------------------------------------------------------------------------
  it("14. Candidate improving one requirement but breaking another is rejected", async () => {
    const originalFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `export default function Contact() { return <div>Stub</div>; }`,
    };

    // Candidate fixes Contact, but breaks Hero completely
    const candidateFiles = {
      ...originalFiles,
      "/components/Hero.js": `export default function Hero() { return <div>Blank</div>; }`,
      "/components/Contact.js": `
        import React from 'react';
        export default function Contact() {
          return <form onSubmit={(e) => e.preventDefault()}><button>Send</button></form>;
        }
      `,
    };

    const originalVerification = {
      overallStatus: "PARTIALLY_VERIFIED",
      passed: 1,
      mandatoryFailed: 1,
      requirements: [
        { requirementId: "mandatory_req_0", priority: "mandatory", status: "PASS", requirementText: "Hero Section" },
        { requirementId: "section_contact", priority: "mandatory", status: "FAIL", requirementText: "Contact Section" },
      ],
    };

    const evalResult = await evaluateRepairCandidate({
      candidateFiles,
      originalFiles,
      originalVerification,
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
    });

    assert.strictEqual(evalResult.accepted, false);
    assert.ok(evalResult.reason.includes("breaks previously passing mandatory requirement"));
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Duplicate repair attempts are prevented
  // --------------------------------------------------------------------------
  it("15. Duplicate repair attempts are detected and aborted to prevent infinite loops", async () => {
    const brokenFiles = {
      ...baseCleanFiles,
      "/components/Contact.js": `export default function Contact() { return <div>Broken Form</div>; }`,
    };

    let attemptsCount = 0;
    // Repair consistently returns the same broken code that fails acceptance
    setAiGeneratorOverride(async () => {
      attemptsCount++;
      return {
        object: {
          path: "/components/Contact.js",
          code: `export default function Contact() { return <div>Broken Form Attempt ${attemptsCount}</div>; }`,
        },
      };
    });

    const result = await runEvidenceDrivenSelfRepairLoop({
      files: brokenFiles,
      prompt: "Create portfolio with contact form",
      requirementContract: sampleContract,
      filePlan: sampleFilePlan,
      maxAttempts: 5,
    });

    assert.strictEqual(result.report.accepted, false);
    // Duplicate detection aborts after attempt 1 because round 2 encounters identical failure signatures
    assert.ok(result.report.attemptCount <= 2, "Should abort early due to duplicate signature");
    assert.ok(result.report.rollbackPerformed);
  });
});
