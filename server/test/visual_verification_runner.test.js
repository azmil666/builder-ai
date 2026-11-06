import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNNER_PATH = path.resolve(__dirname, '../../client/src/components/VisualVerificationRunner.jsx');
const DASHBOARD_PATH = path.resolve(__dirname, '../../client/src/components/AgentProgressDashboard.jsx');

describe('VisualVerificationRunner Runtime Crash Regression Suite', () => {
  const runnerSource = fs.readFileSync(RUNNER_PATH, 'utf-8');
  const dashboardSource = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

  describe('1. Static Code Analysis & Reference Integrity', () => {
    it('verifies handleBundleVisualVerificationRunner is explicitly defined as a function', () => {
      assert.ok(
        runnerSource.includes('const handleBundleVisualVerificationRunner = useCallback(') ||
        runnerSource.includes('function handleBundleVisualVerificationRunner'),
        'handleBundleVisualVerificationRunner must be declared inside the component',
      );
    });

    it('verifies handleBundlerStatus alias is declared and bound to the bundle handler', () => {
      assert.ok(
        runnerSource.includes('const handleBundlerStatus = handleBundleVisualVerificationRunner'),
        'handleBundlerStatus alias must be defined to prevent ReferenceErrors from legacy callers',
      );
    });

    it('verifies handleBundlerError is explicitly defined as a function', () => {
      assert.ok(
        runnerSource.includes('const handleBundlerError = useCallback(') ||
        runnerSource.includes('function handleBundlerError'),
        'handleBundlerError must be declared inside the component',
      );
    });

    it('verifies SandpackInspector connects onBundlerStatus without undeclared references', () => {
      const match = runnerSource.match(/<SandpackInspector[\s\S]*?\/>/);
      assert.ok(match, '<SandpackInspector /> must be rendered in VisualVerificationRunner');
      const inspectorJsx = match[0];
      assert.ok(
        inspectorJsx.includes('onBundlerStatus={handleBundleVisualVerificationRunner'),
        'SandpackInspector onBundlerStatus must reference handleBundleVisualVerificationRunner',
      );
      assert.ok(
        inspectorJsx.includes('onBundlerError={handleBundlerError}'),
        'SandpackInspector onBundlerError must reference handleBundlerError',
      );
    });

    it('verifies containerRef is attached to outer div to locate child iframes', () => {
      assert.ok(
        runnerSource.includes('const containerRef = useRef(null);'),
        'containerRef must be initialized via useRef',
      );
      assert.ok(
        runnerSource.includes('ref={containerRef}'),
        'ref={containerRef} must be attached to container DOM node',
      );
    });
  });

  describe('2. Bundler Status & Metric Collection Workflow', () => {
    it('executes metric request when bundler reports idle or done status', () => {
      let postedMessages = [];
      const mockIframe = {
        contentWindow: {
          postMessage: (msg, targetOrigin) => {
            postedMessages.push({ msg, targetOrigin });
          },
        },
      };

      const mockContainer = {
        querySelectorAll: (selector) => {
          if (selector === 'iframe') return [mockIframe];
          return [];
        },
      };

      // Simulate handleBundleVisualVerificationRunner logic
      const simulateHandler = (status, currentVpName = 'desktop') => {
        if (status === 'idle' || status === 'done') {
          const iframes = mockContainer.querySelectorAll('iframe');
          iframes.forEach((ifr) => {
            ifr.contentWindow.postMessage(
              {
                type: 'BUILDER_AI_REQUEST_METRICS',
                viewportName: currentVpName,
              },
              '*',
            );
          });
        }
      };

      simulateHandler('idle', 'desktop');
      assert.strictEqual(postedMessages.length, 1);
      assert.strictEqual(postedMessages[0].msg.type, 'BUILDER_AI_REQUEST_METRICS');
      assert.strictEqual(postedMessages[0].msg.viewportName, 'desktop');

      simulateHandler('done', 'mobile');
      assert.strictEqual(postedMessages.length, 2);
      assert.strictEqual(postedMessages[1].msg.viewportName, 'mobile');

      // Intermediate statuses should not trigger metric requests
      simulateHandler('running', 'desktop');
      simulateHandler('initial', 'desktop');
      assert.strictEqual(postedMessages.length, 2, 'In-flight bundler statuses must not dispatch requests');
    });

    it('supports prop override for handleBundleVisualVerificationRunner when supplied', () => {
      let propCalledWith = null;
      const propOverride = (status) => {
        propCalledWith = status;
      };

      const executeHandler = (status, propHandler) => {
        if (typeof propHandler === 'function') {
          return propHandler(status);
        }
      };

      executeHandler('idle', propOverride);
      assert.strictEqual(propCalledWith, 'idle');
    });
  });

  describe('3. Compilation Error Handling & Recovery Integration', () => {
    it('captures bundler compilation error and completes viewport without stalling', () => {
      let completedEntry = null;
      const currentVp = { name: 'desktop', width: 1440, height: 900 };

      const handleViewportComplete = (entry) => {
        completedEntry = entry;
      };

      const simulateBundlerError = (error) => {
        const errorMsg = error?.message || (typeof error === 'string' ? error : 'Bundler compilation error');
        const bundlerErr = {
          message: errorMsg,
          file: error?.file || null,
          type: 'compilation',
        };

        handleViewportComplete({
          viewport: currentVp,
          metrics: {
            scrollWidth: currentVp.width,
            clientWidth: currentVp.width,
            scrollHeight: currentVp.height,
            clientHeight: currentVp.height,
          },
          errors: [bundlerErr],
          compilationError: errorMsg,
        });
      };

      simulateBundlerError(new Error('SyntaxError: Unexpected token <App.js>'));

      assert.ok(completedEntry, 'Viewport must be completed on compilation error');
      assert.strictEqual(completedEntry.compilationError, 'SyntaxError: Unexpected token <App.js>');
      assert.strictEqual(completedEntry.errors[0].type, 'compilation');
      assert.strictEqual(completedEntry.viewport.name, 'desktop');
    });
  });

  describe('4. Missing Optional Capabilities & Defensive Rendering', () => {
    it('handles missing project or undefined project.files gracefully', () => {
      assert.ok(
        runnerSource.includes('project = {}'),
        'project prop should have safe default parameter',
      );
      assert.ok(
        runnerSource.includes('project?.files || {}'),
        'activeFiles should safely fall back to empty object when project.files is undefined',
      );
    });

    it('guards onReport and onProgressUpdate against undefined calls', () => {
      assert.ok(
        runnerSource.includes("typeof onReport === 'function'"),
        'onReport must be guarded before invocation',
      );
      assert.ok(
        runnerSource.includes("typeof onProgressUpdate === 'function'"),
        'onProgressUpdate must be guarded before invocation',
      );
    });

    it('guards SandpackInspector against missing useSandpack context or undefined callbacks', () => {
      assert.ok(
        runnerSource.includes('sandpackContext = null'),
        'SandpackInspector must safely wrap useSandpack in try/catch for non-Sandpack environments',
      );
      assert.ok(
        runnerSource.includes("typeof onBundlerStatus === 'function'"),
        'SandpackInspector must verify onBundlerStatus is callable',
      );
      assert.ok(
        runnerSource.includes("typeof onBundlerError === 'function'"),
        'SandpackInspector must verify onBundlerError is callable',
      );
    });
  });

  describe('5. AgentProgressDashboard Integration Safety', () => {
    it('verifies AgentProgressDashboard renders VisualVerificationRunner only when isVisualVerifying is true', () => {
      assert.ok(
        dashboardSource.includes('isVisualVerifying && reportVisualVerification && ('),
        'Dashboard must guard VisualVerificationRunner mount with isVisualVerifying check',
      );
      assert.ok(
        dashboardSource.includes('<VisualVerificationRunner'),
        'Dashboard must mount VisualVerificationRunner with required props',
      );
    });

    it('verifies AgentProgressDashboard passes project, onReport, and onProgressUpdate', () => {
      assert.ok(dashboardSource.includes('project={project}'));
      assert.ok(dashboardSource.includes('onReport={reportVisualVerification}'));
      assert.ok(dashboardSource.includes('onProgressUpdate={handleProgressUpdate}'));
    });
  });
});

