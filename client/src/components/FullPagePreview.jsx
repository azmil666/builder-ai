import React, { useMemo, useState } from "react";
import { detectDependencies } from "../utils/sandpackUtils";
import SandpackErrorMonitor from "./SandpackErrorMonitor";
import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { AlertTriangle, RotateCw } from "lucide-react";

const FullPagePreview = ({ files }) => {
  const [showErrorOverlay, setShowErrorOverlay] = useState(true);
  const [detailedError, setDetailedError] = useState(null);
  const [ignoredPackages, setIgnoredPackages] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Convert liveFiles to Sandpack Format
  const sandpackFiles = useMemo(() => {
    if (!files) return {};
    const spFiles = {};
    for (const [path, content] of Object.entries(files)) {
      spFiles[path] = { code: typeof content === "string" ? content : content?.content || "" };
    }
    return spFiles;
  }, [files]);

  const dependencies = useMemo(() => {
    if (!files) return {};
    const deps = detectDependencies(files);
    for (const p of ignoredPackages) {
      delete deps[p];
    }
    return deps;
  }, [files, ignoredPackages]);

  const handleRetry = () => {
    setDetailedError(null);
    setRefreshKey((k) => k + 1);
  };

  const handleIgnore = (pkg) => {
    if (!pkg) return;
    setIgnoredPackages((prev) => new Set([...prev, pkg]));
    setDetailedError(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-screen w-screen bg-white overflow-hidden relative">
      <SandpackProvider
        key={`fullpage-${refreshKey}`}
        template="react"
        files={sandpackFiles}
        customSetup={{ dependencies }}
        options={{
          externalResources: [
            "https://cdn.tailwindcss.com",
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
          ],
          logLevel: 0,
        }}
        className="h-full w-full"
      >
        <SandpackErrorMonitor
          onErrorChange={setShowErrorOverlay}
          onDetailedErrorChange={setDetailedError}
        />
        <SandpackLayout className="h-full w-full border-none! bg-transparent! relative">
          {detailedError?.isDependencyError && (
            <div className="absolute inset-x-6 top-6 z-50 bg-zinc-900/95 border border-red-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-md text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">Dependency Resolution Failed</h4>
                    <p className="text-xs text-zinc-300 mt-1">
                      {detailedError.package ? (
                        <>Could not resolve package <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">{detailedError.package}</code>.</>
                      ) : (
                        detailedError.reason || "Unable to download required preview dependencies."
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRetry}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCw size={13} />
                    Retry
                  </button>
                  {detailedError.package && (
                    <button
                      onClick={() => handleIgnore(detailedError.package)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Ignore & Load
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={false}
            showSandpackErrorOverlay={showErrorOverlay}
            className="h-full w-full"
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
};

export default FullPagePreview;