import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import {
  CheckIcon,
  CopyIcon,
  FileCodeIcon,
  FileTextIcon,
  Maximize2Icon,
  RotateCwIcon,
  SaveIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { detectDependencies } from '../utils/sandpackUtils';
import { useAppContext } from '../context/AppContext';
import SandpackErrorMonitor from './SandpackErrorMonitor';
import QuickOpenModal from './QuickOpenModal';

function getFileIcon(name) {
  if (name.endsWith('.css')) return <FileTextIcon size={12} className="text-sky-400 shrink-0" />;
  if (name.endsWith('.jsx') || name.endsWith('.js'))
    return <FileCodeIcon size={12} className="text-amber-400 shrink-0" />;
  if (name.endsWith('.json'))
    return <FileTextIcon size={12} className="text-emerald-400 shrink-0" />;
  return <FileTextIcon size={12} className="text-zinc-400 shrink-0" />;
}

// Controller to synchronize Sandpack's active file with AppContext's activeFile
function SandpackTabController({ activeFile }) {
  const { sandpack } = useSandpack();
  useEffect(() => {
    if (activeFile && sandpack.activeFile !== activeFile) {
      try {
        sandpack.openFile(activeFile);
      } catch {
        // Fallback gracefully if file not yet loaded in sandbox
      }
    }
  }, [activeFile, sandpack]);
  return null;
}

// Watches for file edits inside Sandpack editor, marks dirty states, and saves
function SandpackFileWatcher({ onLiveFilesChange, markFileDirty }) {
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
        if (markFileDirty) markFileDirty(path, true);
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
  const {
    openTabs = ['/App.js'],
    dirtyFiles = new Set(),
    openFile,
    closeTab,
    markFileDirty,
    saveNow,
  } = useAppContext();

  const [showErrorOverlay, setShowErrorOverlay] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);

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

  // Global Keyboard Shortcuts (Cmd+S to save, Cmd+P for Quick Open, Cmd+W to close tab)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
      } else if (modifier && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpen((prev) => !prev);
      } else if (modifier && e.key.toLowerCase() === 'w' && showCode) {
        e.preventDefault();
        if (openTabs.length > 1) {
          closeTab(activeFile);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveNow, showCode, openTabs, activeFile, closeTab]);

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
        <SandpackFileWatcher
          onLiveFilesChange={handleLiveFilesChange}
          markFileDirty={markFileDirty}
        />
        <SandpackTabController activeFile={activeFile} />
        <SandpackErrorMonitor onErrorChange={setShowErrorOverlay} />

        {/* Multi-File Tab Bar (When Code is Active) */}
        {showCode && (
          <div className="h-9 shrink-0 bg-zinc-925 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 select-none overflow-x-auto hide-scrollbar">
            {/* Tabs List */}
            <div className="flex items-center h-full overflow-x-auto hide-scrollbar">
              {openTabs.map((tabPath) => {
                const isActive = tabPath === activeFile;
                const isDirty = dirtyFiles.has(tabPath);
                const fileName = tabPath.split('/').pop();

                return (
                  <div
                    key={tabPath}
                    onClick={() => openFile(tabPath)}
                    className={`h-full flex items-center gap-2 px-3.5 border-r border-zinc-800 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-zinc-950 text-white font-medium border-t-2 border-t-indigo-500'
                        : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {getFileIcon(fileName)}
                    <span className="font-mono text-xs">{fileName}</span>

                    {/* Dirty Unsaved Changes Indicator Dot */}
                    {isDirty && (
                      <span
                        className="size-1.5 rounded-full bg-amber-400 animate-pulse"
                        title="Unsaved changes"
                      />
                    )}

                    {/* Close Tab Button */}
                    {openTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tabPath);
                        }}
                        className="p-0.5 rounded hover:text-white hover:bg-zinc-800 transition"
                        title="Close tab"
                      >
                        <XIcon size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Open & Manual Save Shortcut Icons */}
            <div className="flex items-center gap-1.5 px-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsQuickOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                title="Quick Open (Cmd+P)"
              >
                <SearchIcon size={11} />
                <span className="hidden sm:inline">Quick Open</span>
                <span className="text-[10px] bg-zinc-800 px-1 py-0.2 rounded text-zinc-400">⌘P</span>
              </button>

              <button
                type="button"
                onClick={saveNow}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                title="Save Files (Cmd+S)"
              >
                <SaveIcon size={11} />
                <span className="hidden sm:inline">Save</span>
                <span className="text-[10px] bg-zinc-800 px-1 py-0.2 rounded text-zinc-400">⌘S</span>
              </button>

              <button
                type="button"
                onClick={handleCopyActiveCode}
                className="p-1 px-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
                title="Copy current file code"
              >
                {copiedCode ? (
                  <CheckIcon size={11} className="text-emerald-400" />
                ) : (
                  <CopyIcon size={11} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Canvas Toolbar (When Preview is Active and Code is Hidden) */}
        {!showCode && (
          <div className="h-9 shrink-0 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between text-xs text-zinc-400 select-none">
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

            <div className="flex items-center gap-1.5">
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
        )}

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

      {/* Quick Open Modal */}
      <QuickOpenModal
        isOpen={isQuickOpen}
        onClose={() => setIsQuickOpen(false)}
        files={liveFiles}
        onSelectFile={(path) => openFile(path)}
      />
    </div>
  );
};

export default PreviewPanel;
