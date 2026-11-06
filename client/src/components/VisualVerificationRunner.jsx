import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { detectDependencies } from '../utils/sandpackUtils';

const VERIFY_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const OBSERVER_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Verification</title>
    <script>
      function extractAndSendMetrics(viewportName) {
        try {
          var doc = document.documentElement;
          var body = document.body;
          var scrollW = Math.max(doc ? doc.scrollWidth : 0, body ? body.scrollWidth : 0);
          var clientW = doc ? doc.clientWidth : window.innerWidth;
          var scrollH = Math.max(doc ? doc.scrollHeight : 0, body ? body.scrollHeight : 0);
          var clientH = doc ? doc.clientHeight : window.innerHeight;

          window.parent.postMessage({
            type: 'BUILDER_AI_METRICS_REPORT',
            viewportName: viewportName,
            metrics: {
              scrollWidth: scrollW,
              clientWidth: clientW,
              scrollHeight: scrollH,
              clientHeight: clientH,
            },
          }, '*');
        } catch (err) {
          window.parent.postMessage({
            type: 'BUILDER_AI_RUNTIME_ERROR',
            message: err.message,
          }, '*');
        }
      }

      window.addEventListener('message', function(ev) {
        if (ev.data && ev.data.type === 'BUILDER_AI_REQUEST_METRICS') {
          setTimeout(function() {
            extractAndSendMetrics(ev.data.viewportName);
          }, 200);
        }
      });

      window.addEventListener('error', function(ev) {
        window.parent.postMessage({
          type: 'BUILDER_AI_RUNTIME_ERROR',
          message: ev.message || 'Runtime execution error',
          file: ev.filename,
        }, '*');
      });
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

export function SandpackInspector({ onBundlerStatus, onBundlerError }) {
  let sandpackContext = null;
  try {
    sandpackContext = useSandpack();
  } catch {
    sandpackContext = null;
  }

  const status = sandpackContext?.sandpack?.status;
  const error = sandpackContext?.sandpack?.error;

  useEffect(() => {
    if (error && typeof onBundlerError === 'function') {
      onBundlerError(error);
    }
  }, [error, onBundlerError]);

  useEffect(() => {
    if (typeof onBundlerStatus === 'function') {
      return onBundlerStatus(status);
    }
  }, [status, onBundlerStatus]);

  return null;
}

export default function VisualVerificationRunner({
  project = {},
  onReport,
  onProgressUpdate,
  handleBundleVisualVerificationRunner: propHandleBundleVisualVerificationRunner,
}) {
  const [activeFiles, setActiveFiles] = useState(project?.files || {});
  const [viewportIndex, setViewportIndex] = useState(0);
  const [round, setRound] = useState(1); // 1 = initial, 2 = after repair
  const [collectedResults, setCollectedResults] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(true);

  const containerRef = useRef(null);
  const currentVp = VERIFY_VIEWPORTS[viewportIndex] || VERIFY_VIEWPORTS[0];
  const activeFilesRef = useRef(activeFiles);
  activeFilesRef.current = activeFiles;

  // Prepare sandpack files
  const sandpackFiles = useMemo(() => {
    const spFiles = {};
    for (const [path, content] of Object.entries(activeFiles || {})) {
      const code = typeof content === 'string' ? content : content?.content || '';
      spFiles[path] = { code, active: path === '/App.js' };
    }
    // Inject metric extraction script into /public/index.html
    spFiles['/public/index.html'] = {
      code: OBSERVER_INDEX_HTML,
      hidden: true,
    };
    return spFiles;
  }, [activeFiles]);

  const dependencies = useMemo(() => {
    return detectDependencies(activeFiles || {});
  }, [activeFiles]);

  const handleViewportCompleteRef = useRef(null);

  const handleViewportComplete = async (viewportEntry) => {
    const updated = [...collectedResults, viewportEntry];
    setCollectedResults(updated);
    setActiveError(null);

    if (typeof onProgressUpdate === 'function') {
      onProgressUpdate({
        round,
        completedViewport: viewportEntry.viewport.name,
        totalChecked: updated.length,
      });
    }

    // If more viewports to check in this round
    if (viewportIndex + 1 < VERIFY_VIEWPORTS.length) {
      setViewportIndex((prev) => prev + 1);
    } else {
      // Completed all viewports for this round
      submitRoundResults(updated);
    }
  };

  handleViewportCompleteRef.current = handleViewportComplete;

  // Helper to dispatch metric collection request into the Sandpack preview iframe
  const requestMetrics = useCallback(() => {
    const iframes = containerRef.current?.querySelectorAll('iframe');
    if (iframes && iframes.length > 0) {
      iframes.forEach((ifr) => {
        try {
          ifr.contentWindow?.postMessage(
            {
              type: 'BUILDER_AI_REQUEST_METRICS',
              viewportName: currentVp.name,
            },
            '*',
          );
        } catch {
          // Cross-origin safe ignore
        }
      });
    }
  }, [currentVp.name]);

  // Bundle status handler: connects Sandpack bundler state to the visual verification flow
  const handleBundleVisualVerificationRunner = useCallback(
    (status) => {
      if (typeof propHandleBundleVisualVerificationRunner === 'function') {
        return propHandleBundleVisualVerificationRunner(status);
      }

      if (status === 'idle' || status === 'done') {
        requestMetrics();
        const retryTimer = setTimeout(requestMetrics, 350);
        return () => clearTimeout(retryTimer);
      }
    },
    [propHandleBundleVisualVerificationRunner, requestMetrics],
  );

  const handleBundlerStatus = handleBundleVisualVerificationRunner;

  // Bundle error handler: records compilation errors and triggers recovery
  const handleBundlerError = useCallback(
    (error) => {
      const errorMsg =
        error?.message ||
        (typeof error === 'string' ? error : 'Bundler compilation error');
      const bundlerErr = {
        message: errorMsg,
        file: error?.file || error?.path || null,
        type: 'compilation',
      };
      setActiveError(bundlerErr);

      if (handleViewportCompleteRef.current) {
        handleViewportCompleteRef.current({
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
      }
    },
    [currentVp],
  );

  // Listen to postMessage from the iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'BUILDER_AI_RUNTIME_ERROR') {
        setActiveError({
          message: e.data.message,
          file: e.data.file,
        });
      }

      if (e.data.type === 'BUILDER_AI_METRICS_REPORT') {
        const vpName = e.data.viewportName || currentVp.name;
        const matchingVp = VERIFY_VIEWPORTS.find((v) => v.name === vpName) || currentVp;

        const resultEntry = {
          viewport: matchingVp,
          metrics: e.data.metrics,
          errors: activeError ? [activeError] : [],
        };

        if (handleViewportCompleteRef.current) {
          handleViewportCompleteRef.current(resultEntry);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentVp, activeError]);

  // Overall Safety Timeout: if preview bundler or runtime hangs, never hang forever
  useEffect(() => {
    if (!isVerifying) return;
    const safetyTimer = setTimeout(() => {
      console.warn('[Visual QA] Viewport check safety timeout triggered.');
      setIsVerifying(false);
      if (typeof onReport === 'function') {
        onReport(project?._id, {
          viewportResults: collectedResults,
          timedOut: true,
        });
      }
    }, 12000);

    return () => clearTimeout(safetyTimer);
  }, [isVerifying, collectedResults, project?._id, onReport]);

  const submitRoundResults = async (roundResults) => {
    try {
      if (typeof onReport !== 'function') {
        setIsVerifying(false);
        return;
      }

      const response = await onReport(project?._id, {
        viewportResults: roundResults,
      });

      if (response?.needsReverification && response.files && round === 1) {
        // AI repair applied! Start Round 2 (re-verification)
        setRound(2);
        setActiveFiles(response.files);
        setCollectedResults([]);
        setViewportIndex(0);
      } else {
        // Complete (either verified, repaired, unresolved, or unavailable)
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('[Visual QA] Failed to submit verification results:', err);
      setIsVerifying(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: `${currentVp.width}px`,
        height: `${currentVp.height}px`,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <SandpackProvider
        key={`qa-${round}-${currentVp.name}`}
        template="react"
        files={sandpackFiles}
        customSetup={{ dependencies }}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
          ],
          logLevel: 0,
        }}
      >
        <SandpackInspector
          onBundlerStatus={handleBundleVisualVerificationRunner || handleBundlerStatus}
          onBundlerError={handleBundlerError}
        />
        <div style={{ width: `${currentVp.width}px`, height: `${currentVp.height}px` }}>
          <SandpackPreview
            style={{ width: '100%', height: '100%' }}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        </div>
      </SandpackProvider>
    </div>
  );
}
