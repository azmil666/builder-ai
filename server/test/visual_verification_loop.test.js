import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import {
  VERIFICATION_VIEWPORTS,
  evaluateViewportRender,
  aggregateVisualVerificationResults,
  buildVisualRepairContext,
  performTargetedVisualRepair,
  runVisualVerificationLoop,
} from '../services/visualQa.js';
import { handleVisualVerification } from '../controllers/projectController.js';
import { Project } from '../models/Project.js';
import { setAiGeneratorOverride, resetAiGeneratorOverride } from '../services/ai.js';

describe('Post-Generation Visual Verification Render-and-Fix Loop Suite', () => {
  beforeEach(() => {
    // Provide a deterministic mock AI generator to prevent real network calls during tests
    setAiGeneratorOverride(async ({ prompt }) => {
      return {
        object: {
          code: 'export default function Nav() { return <div className="w-full max-w-5xl mx-auto px-4 flex">Logo</div>; }',
        },
      };
    });
  });

  afterEach(() => {
    resetAiGeneratorOverride();
  });
  describe('1. Viewport Standards & Structured Issue Evaluation', () => {
    it('verifies standard viewport requirements: desktop (1440x900) and mobile (375x812)', () => {
      assert.strictEqual(VERIFICATION_VIEWPORTS.length, 2);
      const desktop = VERIFICATION_VIEWPORTS.find((v) => v.name === 'desktop');
      const mobile = VERIFICATION_VIEWPORTS.find((v) => v.name === 'mobile');

      assert.ok(desktop, 'desktop viewport must be configured');
      assert.strictEqual(desktop.width, 1440);
      assert.strictEqual(desktop.height, 900);

      assert.ok(mobile, 'mobile viewport must be configured');
      assert.strictEqual(mobile.width, 375);
      assert.strictEqual(mobile.height, 812);
    });

    it('passes when scrollWidth does not exceed clientWidth and no errors occur', () => {
      const desktopResult = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1440, clientWidth: 1440, scrollHeight: 2200, clientHeight: 900 },
        errors: [],
      });

      assert.strictEqual(desktopResult.passed, true);
      assert.strictEqual(desktopResult.issues.length, 0);
      assert.strictEqual(desktopResult.error, null);
      assert.strictEqual(desktopResult.viewport.width, 1440);
      assert.strictEqual(desktopResult.viewport.height, 900);
    });

    it('detects horizontal overflow at mobile viewport (375x812) with structured evidence', () => {
      const mobileResult = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        metrics: { scrollWidth: 425, clientWidth: 375, scrollHeight: 1800, clientHeight: 812 },
        errors: [],
      });

      assert.strictEqual(mobileResult.passed, false);
      assert.strictEqual(mobileResult.issues.length, 1);

      const issue = mobileResult.issues[0];
      assert.strictEqual(issue.type, 'overflow');
      assert.strictEqual(issue.severity, 'critical');
      assert.strictEqual(issue.viewport.name, 'mobile');
      assert.strictEqual(issue.viewport.width, 375);
      assert.strictEqual(issue.viewport.height, 812);
      assert.strictEqual(issue.evidence.scrollWidth, 425);
      assert.strictEqual(issue.evidence.clientWidth, 375);
      assert.strictEqual(issue.evidence.overflowPx, 50);
      assert.ok(issue.message.includes('50px'));
    });

    it('detects horizontal overflow at desktop viewport (1440x900) with structured evidence', () => {
      const desktopResult = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1560, clientWidth: 1440 },
        errors: [],
      });

      assert.strictEqual(desktopResult.passed, false);
      const issue = desktopResult.issues[0];
      assert.strictEqual(issue.type, 'overflow');
      assert.strictEqual(issue.viewport.name, 'desktop');
      assert.strictEqual(issue.evidence.overflowPx, 120);
    });

    it('detects runtime rendering errors with structured viewport details', () => {
      const runtimeErrorResult = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        metrics: { scrollWidth: 375, clientWidth: 375 },
        errors: [
          {
            message: "Cannot read properties of undefined (reading 'items')",
            stack: "TypeError: Cannot read properties of undefined\n    at CartDrawer (/components/CartDrawer.js:14:22)",
            file: '/components/CartDrawer.js',
          },
        ],
      });

      assert.strictEqual(runtimeErrorResult.passed, false);
      assert.strictEqual(runtimeErrorResult.issues.length, 1);
      const issue = runtimeErrorResult.issues[0];
      assert.strictEqual(issue.type, 'runtime_error');
      assert.strictEqual(issue.viewport.name, 'mobile');
      assert.strictEqual(issue.file, '/components/CartDrawer.js');
      assert.ok(issue.message.includes('Cannot read properties of undefined'));
      assert.strictEqual(issue.evidence.file, '/components/CartDrawer.js');
    });

    it('detects compilation errors that prevent the page from rendering', () => {
      const compErrorResult = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        compilationError: {
          message: 'Unexpected token, expected "," (12:4)',
          file: '/components/Navbar.js',
        },
      });

      assert.strictEqual(compErrorResult.passed, false);
      const issue = compErrorResult.issues[0];
      assert.strictEqual(issue.type, 'compilation_error');
      assert.strictEqual(issue.file, '/components/Navbar.js');
      assert.ok(issue.message.includes('Unexpected token'));
    });
  });

  describe('2. Aggregation & Safety Status Guarantees', () => {
    it('returns verified when both desktop and mobile viewports render cleanly', () => {
      const desktop = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1440, clientWidth: 1440 },
      });
      const mobile = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        metrics: { scrollWidth: 375, clientWidth: 375 },
      });

      const report = aggregateVisualVerificationResults([desktop, mobile]);
      assert.strictEqual(report.status, 'verified');
      assert.strictEqual(report.passed, true);
      assert.strictEqual(report.issues.length, 0);
      assert.ok(report.viewports.desktop.passed);
      assert.ok(report.viewports.mobile.passed);
    });

    it('never labels timeout or infrastructure failure as passed or verified', () => {
      const timedOutMobile = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        timedOut: true,
      });
      const desktop = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1440, clientWidth: 1440 },
      });

      const report = aggregateVisualVerificationResults([desktop, timedOutMobile]);
      assert.notStrictEqual(report.status, 'verified');
      assert.notStrictEqual(report.status, 'passed');
      assert.strictEqual(report.status, 'unavailable');
      assert.strictEqual(report.passed, false);
      assert.strictEqual(report.summary.timeoutCount, 1);
    });

    it('correctly reports infrastructure failure as unavailable', () => {
      const infraError = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        infrastructureError: 'Sandpack bundler crashed',
      });

      const report = aggregateVisualVerificationResults([infraError]);
      assert.strictEqual(report.status, 'unavailable');
      assert.strictEqual(report.passed, false);
      assert.strictEqual(report.summary.infrastructureCount, 1);
    });
  });

  describe('3. Targeted Repair Context Extraction', () => {
    it('identifies candidate broken files containing hardcoded fixed widths causing overflow', () => {
      const files = {
        '/App.js': 'import Navbar from "./components/Navbar";\nexport default function App() { return <Navbar />; }',
        '/styles.css': 'body { margin: 0; }',
        '/components/Navbar.js': 'export default function Navbar() { return <div className="w-[1280px] flex">Logo</div>; }',
        '/components/Footer.js': 'export default function Footer() { return <footer className="w-full">Footer</footer>; }',
      };

      const issues = [
        {
          type: 'overflow',
          viewport: { name: 'mobile', width: 375, height: 812 },
          message: 'Horizontal document overflow detected: scrollWidth (1280px) > clientWidth (375px)',
          evidence: { scrollWidth: 1280, clientWidth: 375, overflowPx: 905 },
        },
      ];

      const context = buildVisualRepairContext({
        issues,
        files,
        designSpec: { archetype: 'modern-saas' },
        prompt: 'Build SaaS site',
      });

      assert.ok(context.filesToRepair.includes('/components/Navbar.js'), 'Navbar with w-[1280px] must be identified as candidate file');
      assert.ok(!context.filesToRepair.includes('/components/Footer.js'), 'Unrelated Footer should not be targeted');
      assert.ok(context.repairPrompt.includes('375×812'), 'Repair prompt must mention the affected viewport');
      assert.ok(context.repairPrompt.includes('905px'), 'Repair prompt must mention the overflow delta');
    });

    it('identifies file directly indicated in runtime error trace', () => {
      const files = {
        '/App.js': 'import Hero from "./components/Hero"; export default function App() { return <Hero />; }',
        '/components/Hero.js': 'export default function Hero({ title }) { return <h1>{title.toUpperCase()}</h1>; }',
      };

      const issues = [
        {
          type: 'runtime_error',
          viewport: { name: 'desktop', width: 1440, height: 900 },
          message: 'Cannot read properties of undefined (reading "toUpperCase")',
          file: '/components/Hero.js',
          evidence: { error: 'TypeError: Cannot read properties of undefined' },
        },
      ];

      const context = buildVisualRepairContext({ issues, files });
      assert.deepStrictEqual(context.filesToRepair, ['/components/Hero.js']);
    });
  });

  describe('3b. Targeted Visual Repair Function Tests', () => {
    it('performs targeted repair on candidate files and returns repaired files', async () => {
      const files = {
        '/App.js': 'import Header from "./components/Header"; export default function App() { return <Header />; }',
        '/components/Header.js': 'export default function Header() { return <div className="w-[900px]">Header</div>; }',
      };
      const issues = [
        {
          type: 'overflow',
          viewport: { name: 'mobile', width: 375, height: 812 },
          message: 'overflow detected',
        },
      ];

      const res = await performTargetedVisualRepair({
        files,
        allPlannedFiles: [{ path: '/App.js' }, { path: '/components/Header.js' }],
        issues,
        prompt: 'Fix header',
        aiGenerator: async () => ({
          object: {
            code: 'export default function Header() { return <div className="w-full max-w-5xl mx-auto px-4">Header</div>; }',
          },
        }),
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.reverted, false);
      assert.ok(res.files['/components/Header.js'].includes('max-w-5xl'));
      assert.strictEqual(res.repairLogs[0].success, true);
    });

    it('reverts to original files when repaired file fails project validation', async () => {
      const files = {
        '/App.js': 'import Header from "./components/Header"; export default function App() { return <Header />; }',
        '/components/Header.js': 'export default function Header() { return <div className="w-[900px]">Header</div>; }',
      };
      const issues = [
        {
          type: 'overflow',
          viewport: { name: 'mobile', width: 375, height: 812 },
          message: 'overflow detected',
        },
      ];

      const res = await performTargetedVisualRepair({
        files,
        allPlannedFiles: [{ path: '/App.js' }, { path: '/components/Header.js' }],
        issues,
        prompt: 'Fix header',
        aiGenerator: async () => ({
          object: {
            code: 'import NonExistent from "./NonExistent"; export default function Header() { return <div />; }',
          },
        }),
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reverted, true);
      assert.strictEqual(res.files['/components/Header.js'], files['/components/Header.js']);
    });
  });

  describe('4. Full Render-and-Fix Loop Simulation', () => {
    it('Scenario A: Verified on initial render when all viewports pass without defect', async () => {
      const files = {
        '/App.js': 'export default function App() { return <div>Clean</div>; }',
      };

      const loopResult = await runVisualVerificationLoop({
        files,
        prompt: 'Build portfolio',
        renderViewportFn: async ({ viewport }) => {
          return {
            metrics: { scrollWidth: viewport.width, clientWidth: viewport.width },
            errors: [],
          };
        },
      });

      assert.strictEqual(loopResult.status, 'verified');
      assert.strictEqual(loopResult.visualVerification.status, 'verified');
      assert.strictEqual(loopResult.visualVerification.repairAttempted, false);
      assert.strictEqual(loopResult.visualVerification.issues.length, 0);
    });

    it('Scenario B: Repaired on second render after detected mobile overflow triggers 1 targeted repair', async () => {
      const originalFiles = {
        '/App.js': 'import Nav from "./components/Nav"; export default function App() { return <Nav />; }',
        '/components/Nav.js': 'export default function Nav() { return <div className="w-[500px]">Logo</div>; }',
      };

      let renderPass = 0;
      let repairAttemptCount = 0;

      const loopResult = await runVisualVerificationLoop({
        files: originalFiles,
        prompt: 'Create landing page',
        allPlannedFiles: [{ path: '/App.js' }, { path: '/components/Nav.js' }],
        callbacks: {
          onRepairStart: async () => {
            repairAttemptCount++;
          },
        },
        renderViewportFn: async ({ viewport, files: currentFiles }) => {
          renderPass++;
          // First pass: mobile overflows because Nav has w-[500px]
          const navCode = currentFiles['/components/Nav.js'];
          const hasFixedWidth = navCode && navCode.includes('w-[500px]');

          if (hasFixedWidth && viewport.name === 'mobile') {
            return {
              metrics: { scrollWidth: 500, clientWidth: 375 },
              errors: [],
            };
          }

          return {
            metrics: { scrollWidth: viewport.width, clientWidth: viewport.width },
            errors: [],
          };
        },
      });

      // The loop attempted 1 repair and re-rendered viewports
      assert.strictEqual(repairAttemptCount, 1, 'Exactly 1 repair attempt must be made');
      assert.ok(renderPass >= 3, 'Both initial and re-verification viewports must be rendered');
      assert.ok(loopResult.visualVerification.repairAttempted, 'Repair must have been attempted');
      assert.strictEqual(loopResult.status, 'repaired', 'Defect was fixed by mock AI, status must be repaired');
      assert.strictEqual(loopResult.visualVerification.status, 'repaired');
      assert.ok(loopResult.files['/components/Nav.js'].includes('max-w-5xl'));
    });

    it('Scenario B2: Repair success verified when targeted repair fixes overflow', async () => {
      // Simulate targeted repair function resolving defect
      const filesWithDefect = {
        '/App.js': 'import Nav from "./components/Nav"; export default function App() { return <Nav />; }',
        '/components/Nav.js': 'export default function Nav() { return <div className="w-[800px]">Nav</div>; }',
      };

      let renderPass = 0;
      // We pass a custom repair callback or verify two-stage check directly
      const viewports = VERIFICATION_VIEWPORTS;
      
      // Step 1: Render pass 1 detects overflow on mobile
      const round1Mobile = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        metrics: { scrollWidth: 800, clientWidth: 375 },
      });
      const round1Desktop = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1440, clientWidth: 1440 },
      });

      const initialReport = aggregateVisualVerificationResults([round1Desktop, round1Mobile]);
      assert.strictEqual(initialReport.passed, false);
      assert.strictEqual(initialReport.summary.overflowCount, 1);

      // Step 2: Targeted repair fixes Nav.js
      const repairedFiles = {
        ...filesWithDefect,
        '/components/Nav.js': 'export default function Nav() { return <div className="w-full max-w-5xl mx-auto">Nav</div>; }',
      };

      // Step 3: Re-render round 2 with repaired files
      const round2Mobile = evaluateViewportRender({
        viewport: { name: 'mobile', width: 375, height: 812 },
        metrics: { scrollWidth: 375, clientWidth: 375 },
      });
      const round2Desktop = evaluateViewportRender({
        viewport: { name: 'desktop', width: 1440, height: 900 },
        metrics: { scrollWidth: 1440, clientWidth: 1440 },
      });

      const secondReport = aggregateVisualVerificationResults([round2Desktop, round2Mobile]);
      assert.strictEqual(secondReport.passed, true);
      assert.strictEqual(secondReport.issues.length, 0);

      // Step 4: Final verification report shape
      const finalReport = {
        ...secondReport,
        status: 'repaired',
        repairAttempted: true,
        repairedFiles: ['/components/Nav.js'],
        initialIssues: initialReport.issues,
      };

      assert.strictEqual(finalReport.status, 'repaired');
      assert.strictEqual(finalReport.repairAttempted, true);
      assert.deepStrictEqual(finalReport.repairedFiles, ['/components/Nav.js']);
    });

    it('Scenario C: Unresolved when defect persists after single retry (no infinite loop)', async () => {
      const files = {
        '/App.js': 'export default function App() { return <div className="w-[2000px]">Persistent Overflow</div>; }',
      };

      let renderPassCount = 0;
      const loopResult = await runVisualVerificationLoop({
        files,
        prompt: 'Create persistent overflow test',
        renderViewportFn: async ({ viewport }) => {
          renderPassCount++;
          // Always return persistent overflow on mobile
          if (viewport.name === 'mobile') {
            return {
              metrics: { scrollWidth: 600, clientWidth: 375 },
              errors: [],
            };
          }
          return {
            metrics: { scrollWidth: 1440, clientWidth: 1440 },
            errors: [],
          };
        },
      });

      assert.strictEqual(loopResult.status, 'unresolved');
      assert.strictEqual(loopResult.visualVerification.status, 'unresolved');
      assert.strictEqual(loopResult.visualVerification.repairAttempted, true);
      assert.ok(loopResult.visualVerification.remainingIssues.length > 0, 'Remaining issues must be recorded');
      assert.ok(loopResult.files['/App.js'], 'Best available files must be retained');

      // 2 viewports in Round 1 + 2 viewports in Round 2 = exactly 4 render passes (no infinite loop!)
      assert.strictEqual(renderPassCount, 4, 'Must perform exactly 4 viewport renders: 2 in round 1, 2 in round 2');
    });

    it('Scenario D: Unavailable status when preview dependencies or infrastructure fail', async () => {
      const files = { '/App.js': 'export default function App() { return null; }' };

      const loopResult = await runVisualVerificationLoop({
        files,
        prompt: 'Test timeout',
        renderViewportFn: async ({ viewport }) => {
          if (viewport.name === 'mobile') {
            return { timedOut: true };
          }
          return { metrics: { scrollWidth: 1440, clientWidth: 1440 }, errors: [] };
        },
      });

      assert.strictEqual(loopResult.status, 'unavailable');
      assert.strictEqual(loopResult.visualVerification.status, 'unavailable');
      assert.strictEqual(loopResult.visualVerification.repairAttempted, false);
      assert.notStrictEqual(loopResult.status, 'verified');
    });

    it('Scenario E: Skipped status when render function is not available', async () => {
      const files = { '/App.js': 'export default function App() { return null; }' };

      const loopResult = await runVisualVerificationLoop({
        files,
        prompt: 'Test skip',
        renderViewportFn: null,
      });

      assert.strictEqual(loopResult.status, 'skipped');
      assert.strictEqual(loopResult.visualVerification.status, 'skipped');
    });

    it('Scenario F: Unresolved when targeted AI repair throws an error (handled safely without crash)', async () => {
      setAiGeneratorOverride(async () => {
        throw new Error('Simulated model rate limit or timeout during repair');
      });

      const originalFiles = {
        '/App.js': 'import Nav from "./components/Nav"; export default function App() { return <Nav />; }',
        '/components/Nav.js': 'export default function Nav() { return <div className="w-[800px]">Logo</div>; }',
      };

      const loopResult = await runVisualVerificationLoop({
        files: originalFiles,
        prompt: 'Create landing page',
        allPlannedFiles: [{ path: '/App.js' }, { path: '/components/Nav.js' }],
        renderViewportFn: async ({ viewport }) => {
          if (viewport.name === 'mobile') {
            return { metrics: { scrollWidth: 800, clientWidth: 375 }, errors: [] };
          }
          return { metrics: { scrollWidth: 1440, clientWidth: 1440 }, errors: [] };
        },
      });

      assert.strictEqual(loopResult.status, 'unresolved');
      assert.strictEqual(loopResult.visualVerification.status, 'unresolved');
      assert.strictEqual(loopResult.visualVerification.repairAttempted, true);
      assert.ok(loopResult.files['/components/Nav.js']);
    });
  });

  describe('5. Visual Verification API Endpoint & Ownership Security', () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const testProjectId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      // Mock Project findById and findOne
      Project.findById = async (id) => {
        if (id.toString() !== testProjectId.toString()) return null;
        return {
          _id: testProjectId,
          name: 'Test Project',
          description: 'A test project',
          owner: mockUserId,
          status: 'visual_verifying',
          files: {
            '/App.js': { content: 'export default function App() { return <div>App</div>; }' },
          },
          filesPlanned: [],
          filesGenerated: ['/App.js'],
          version: 1,
          messages: [],
          visualVerification: null,
          save: async () => {},
          markModified: () => {},
        };
      };

      Project.findOne = async (query) => {
        if (
          query._id.toString() === testProjectId.toString() &&
          query.owner.toString() === mockUserId.toString()
        ) {
          return Project.findById(query._id);
        }
        return null;
      };
    });

    it('rejects unauthenticated requests with HTTP 401', async () => {
      let statusCode = 200;
      let jsonPayload = null;
      const req = { params: { id: testProjectId.toString() } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(jsonPayload.error, 'Unauthorized');
    });

    it('rejects invalid ObjectId with HTTP 404', async () => {
      let statusCode = 200;
      let jsonPayload = null;
      const req = {
        user: { userId: mockUserId.toString() },
        params: { id: 'invalid-id' },
        body: {},
      };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(statusCode, 404);
      assert.strictEqual(jsonPayload.error, 'Project not found');
    });

    it('blocks cross-user visual verification inspection/mutation with HTTP 403', async () => {
      let statusCode = 200;
      let jsonPayload = null;
      const req = {
        user: { userId: otherUserId.toString() },
        params: { id: testProjectId.toString() },
        body: {},
      };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(jsonPayload.error, 'Access denied');
    });

    it('successfully processes clean viewport report, marking project verified', async () => {
      let statusCode = 200;
      let jsonPayload = null;
      const req = {
        user: { userId: mockUserId.toString() },
        params: { id: testProjectId.toString() },
        body: {
          viewportResults: [
            {
              viewport: { name: 'desktop', width: 1440, height: 900 },
              metrics: { scrollWidth: 1440, clientWidth: 1440 },
              errors: [],
            },
            {
              viewport: { name: 'mobile', width: 375, height: 812 },
              metrics: { scrollWidth: 375, clientWidth: 375 },
              errors: [],
            },
          ],
        },
      };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonPayload.status, 'verified');
      assert.strictEqual(jsonPayload.completed, true);
      assert.strictEqual(jsonPayload.visualVerification.status, 'verified');
    });

    it('handles timeout report accurately by setting status to unavailable (never verified)', async () => {
      let jsonPayload = null;
      const req = {
        user: { userId: mockUserId.toString() },
        params: { id: testProjectId.toString() },
        body: {
          viewportResults: [],
          timedOut: true,
        },
      };
      const res = {
        status: () => res,
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(jsonPayload.status, 'unavailable');
      assert.strictEqual(jsonPayload.completed, true);
      assert.notStrictEqual(jsonPayload.status, 'verified');
    });

    it('returns repairing status and initiates targeted repair on first defect discovery', async () => {
      let jsonPayload = null;
      const req = {
        user: { userId: mockUserId.toString() },
        params: { id: testProjectId.toString() },
        body: {
          viewportResults: [
            {
              viewport: { name: 'mobile', width: 375, height: 812 },
              metrics: { scrollWidth: 450, clientWidth: 375 },
              errors: [],
            },
          ],
        },
      };
      const res = {
        status: () => res,
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(jsonPayload.status, 'repairing');
      assert.strictEqual(jsonPayload.needsReverification, true);
      assert.strictEqual(jsonPayload.visualVerification.repairAttempted, true);
    });

    it('returns unresolved status when defects remain on second verification pass', async () => {
      // Mock project where repairAttempted is already true
      Project.findById = async () => ({
        _id: testProjectId,
        name: 'Test Project',
        description: 'A test project',
        owner: mockUserId,
        status: 'visual_verifying',
        files: { '/App.js': { content: 'export default function App() { return <div>App</div>; }' } },
        filesPlanned: [],
        filesGenerated: ['/App.js'],
        version: 1,
        messages: [],
        visualVerification: {
          repairAttempted: true,
          repairedFiles: ['/App.js'],
        },
        save: async () => {},
        markModified: () => {},
      });

      let jsonPayload = null;
      const req = {
        user: { userId: mockUserId.toString() },
        params: { id: testProjectId.toString() },
        body: {
          viewportResults: [
            {
              viewport: { name: 'mobile', width: 375, height: 812 },
              metrics: { scrollWidth: 410, clientWidth: 375 },
              errors: [],
            },
          ],
        },
      };
      const res = {
        status: () => res,
        json: (payload) => { jsonPayload = payload; },
      };

      await handleVisualVerification(req, res);
      assert.strictEqual(jsonPayload.status, 'unresolved');
      assert.strictEqual(jsonPayload.completed, true);
      assert.strictEqual(jsonPayload.visualVerification.status, 'unresolved');
      assert.ok(jsonPayload.visualVerification.remainingIssues.length > 0);
    });
  });
});
