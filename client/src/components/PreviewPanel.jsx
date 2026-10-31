import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import {
  CopyIcon,
  FileCodeIcon,
  Maximize2Icon,
  RotateCwIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { detectDependencies } from '../utils/sandpackUtils';
import { useAppContext } from '../context/AppContext';
import SandpackErrorMonitor from './SandpackErrorMonitor';

// Watches for file edits inside Sandpack editor and saves changes to DB & live state
function SandpackFileWatcher({ onLiveFilesChange }) {
  const { sandpack } = useSandpack();
  const { files } = sandpack;
  const { activeProject, updateProjectFiles } = useAppContext();

  const activeProjectRef = useRef(activeProject);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    const project = activeProjectRef.current;
    if (!project) return;
    const updatedFiles = {};
    let hasChanges = false;

    for (const [path, fileObj] of Object.entries(files)) {
      const fileCode = fileObj.code;
      updatedFiles[path] = fileCode;
      const originalContent =
        typeof project.files[path] === 'string'
          ? project.files[path]
          : project.files[path]?.content;
      if (originalContent !== undefined && originalContent !== fileCode) {
        hasChanges = true;
      }
    }

    onLiveFilesChange(updatedFiles);
    if (hasChanges) {
      updateProjectFiles(updatedFiles);
    }
  }, [files]);

  return null;
}

const PreviewPanel = ({
  project,
  activeFile = '/App.js',
  showCode = false,
  deviceViewport = 'desktop', // 'desktop' | 'tablet' | 'mobile'
}) => {
  const [showErrorOverlay, setShowErrorOverlay] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Keep local state of files that updates as user types
  const [liveFiles, setLiveFiles] = useState(project.files || {});
  const [prevProjectKey, setPrevProjectKey] = useState(
    `${project._id}-${project.version}`,
  );

  const currentKey = `${project._id}-${project.version}`;
  if (prevProjectKey !== currentKey) {
    setPrevProjectKey(currentKey);
    setLiveFiles(project.files || {});
  }

  const handleLiveFilesChange = (newFiles) => {
    setLiveFiles((prev) => {
      let changed = false;
      for (const [p, code] of Object.entries(newFiles)) {
        if (prev[p] !== code) {
          changed = true;
          break;
        }
      }
      return changed ? newFiles : prev;
    });
  };

  // Convert liveFiles to Sandpack format
  const sandpackFiles = useMemo(() => {
    const spFiles = {};
    for (const [path, content] of Object.entries(liveFiles)) {
      const fileCode =
        typeof content === 'string' ? content : content?.content || '';
      spFiles[path] = {
        code: fileCode,
        active: path === activeFile,
      };
    }
    return spFiles;
  }, [liveFiles, activeFile]);

  // Detect dependencies from import statements using liveFiles
  const dependencies = useMemo(() => {
    return detectDependencies(liveFiles);
  }, [liveFiles]);

  const handleCopyActiveCode = () => {
    const currentCode =
      typeof liveFiles[activeFile] === 'string'
        ? liveFiles[activeFile]
        : liveFiles[activeFile]?.content || '';
    if (currentCode) {
      navigator.clipboard.writeText(currentCode);
      setCopiedCode(true);
      toast.success(`Copied ${activeFile}`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Viewport dimensions & frame styles
  const viewportStyles = useMemo(() => {
    if (deviceViewport === 'mobile') {
      return {
        width: '375px',
        maxWidth: '100%',
        height: '92%',
        margin: 'auto',
        borderRadius: '32px',
        border: '10px solid #18181b',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    if (deviceViewport === 'tablet') {
      return {
        width: '768px',
        maxWidth: '100%',
        height: '95%',
        margin: 'auto',
        borderRadius: '20px',
        border: '8px solid #27272a',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    return {
      width: '100%',
      height: '100%',
      borderRadius: '0px',
      border: 'none',
      boxShadow: 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }, [deviceViewport]);

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 overflow-hidden">
      <SandpackProvider
        key={`${project._id}-${refreshKey}`}
        template="react"
        files={sandpackFiles}
        customSetup={{ dependencies }}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
          ],
          classes: {
            'sp-wrapper': 'sp-wrapper h-full w-full',
            'sp-layout': 'sp-layout h-full w-full',
            'sp-preview': 'sp-preview h-full w-full',
          },
          logLevel: 0,
        }}
        theme={{
          colors: {
            surface1: '#09090b',
            surface2: '#18181b',
            surface3: '#27272a',
            clickable: '#a1a1aa',
            base: '#f4f4f5',
            disabled: '#52525b',
            hover: '#ffffff',
            accent: '#6366f1',
            error: '#ef4444',
            errorSurface: '#450a0a',
          },
          font: {
            body: "'Urbanist', system-ui, -apple-system, sans-serif",
            mono: "'Geist Mono', ui-monospace, monospace",
            size: '12px',
            lineHeight: '1.6',
          },
        }}
        className="h-full w-full flex flex-col"
      >
        <SandpackFileWatcher onLiveFilesChange={handleLiveFilesChange} />
        <SandpackErrorMonitor onErrorChange={setShowErrorOverlay} />

        {/* Workspace Canvas Toolbar */}
        <div className="h-9 shrink-0 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between text-xs text-zinc-400 select-none">
          <div className="flex items-center gap-2">
            {showCode ? (
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-200">
                <FileCodeIcon size={13} className="text-indigo-400" />
                <span>{activeFile}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[11px] text-zinc-300">Live Preview</span>
                <span className="text-zinc-600">·</span>
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  {deviceViewport === 'desktop'
                    ? '100% Responsive'
                    : deviceViewport === 'tablet'
                      ? '768px Tablet'
                      : '375px Mobile'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {showCode && (
              <button
                type="button"
                onClick={handleCopyActiveCode}
                className="flex items-center gap-1 p-1 px-2 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Copy current file code"
              >
                <CopyIcon size={11} />
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setRefreshKey((k) => k + 1);
                toast.success('Reloading preview runtime');
              }}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Refresh live preview"
            >
              <RotateCwIcon size={12} />
            </button>

            <button
              type="button"
              onClick={() => window.open(`/preview/${project._id}`, '_blank')}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Open full page preview"
            >
              <Maximize2Icon size={12} />
            </button>
          </div>
        </div>

        {/* Sandpack Layout Area */}
        <div className="flex-1 w-full overflow-hidden flex bg-zinc-950">
          <SandpackLayout
            style={{
              height: '100%',
              width: '100%',
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
              display: 'flex',
            }}
          >
            {/* Code Editor Panel */}
            {showCode && (
              <div className="h-full flex-1 min-w-[280px] border-r border-zinc-800 overflow-hidden bg-zinc-950">
                <SandpackCodeEditor
                  showTabs={false}
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  style={{
                    height: '100%',
                    width: '100%',
                    backgroundColor: '#09090b',
                  }}
                />
              </div>
            )}

            {/* Preview Canvas Area */}
            <div
              className={`h-full flex items-center justify-center overflow-auto ${
                showCode ? 'flex-1' : 'w-full'
              } ${
                deviceViewport !== 'desktop'
                  ? 'bg-zinc-925 p-4 sm:p-6 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]'
                  : 'bg-zinc-950'
              }`}
            >
              <div style={viewportStyles}>
                {/* Mobile Camera Notch */}
                {deviceViewport === 'mobile' && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-zinc-900 rounded-full z-30 pointer-events-none flex items-center justify-center">
                    <div className="size-2 rounded-full bg-black/60" />
                  </div>
                )}

                <SandpackPreview
                  showNavigator={false}
                  showRefreshButton={false}
                  showOpenInCodeSandbox={false}
                  showSandpackErrorOverlay={showErrorOverlay}
                  style={{
                    height: '100%',
                    width: '100%',
                    minWidth: 0,
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            </div>
          </SandpackLayout>
        </div>
      </SandpackProvider>
    </div>
  );
};

export default PreviewPanel;
