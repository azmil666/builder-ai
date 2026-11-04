import React from 'react';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Code2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  GlobeIcon,
  Loader2Icon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
} from 'lucide-react';

const BuilderHeader = ({
  projectName,
  version = 1,
  showCode = false,
  deviceViewport = 'desktop', // 'desktop' | 'tablet' | 'mobile'
  syncStatus = 'saved', // 'saved' | 'saving' | 'error'
  publishing = false,
  visualVerification = null,
  onToggleViewMode,
  onChangeDeviceViewport,
  onOpenPreview,
  onPublish,
  onDownload,
  onBack,
}) => {
  return (
    <header className="h-13 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-zinc-800 bg-zinc-950 text-zinc-100 z-30 select-none">
      {/* Left Area: Back, Logo, Project Name, Version, Sync */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onBack}
          type="button"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
          title="Back to Dashboard"
        >
          <ArrowLeftIcon size={16} />
        </button>

        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
            <img src="/logo.svg" alt="Builder AI" className="size-4" />
          </div>
          <span className="hidden md:inline font-semibold text-xs tracking-tight text-zinc-300">
            Builder<span className="text-indigo-400">AI</span>
          </span>
          <span className="hidden md:inline text-zinc-600">/</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[130px] sm:max-w-[200px] md:max-w-[280px]">
            {projectName || 'Untitled Project'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
            v{version}
          </span>
        </div>

        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 text-[11px] font-mono text-zinc-400">
          {syncStatus === 'saving' ? (
            <>
              <Loader2Icon size={11} className="animate-spin text-amber-400" />
              <span className="text-amber-400/90">Saving...</span>
            </>
          ) : syncStatus === 'error' ? (
            <span className="text-red-400">Sync Error</span>
          ) : (
            <>
              <CheckCircle2Icon size={11} className="text-emerald-400" />
              <span>Saved</span>
            </>
          )}
        </div>

        {/* Post-Generation Visual Verification Status Outcome */}
        {visualVerification && visualVerification.status && (
          <div
            className={`hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border transition ${
              visualVerification.status === 'verified'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : visualVerification.status === 'repaired'
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : visualVerification.status === 'unresolved'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
            title={
              visualVerification.status === 'verified'
                ? 'Verified: desktop (1440×900) & mobile (375×812) viewports clean with 0 horizontal overflow'
                : visualVerification.status === 'repaired'
                  ? 'Repaired: defects resolved by targeted AI repair & re-verified on 2nd render'
                  : visualVerification.status === 'unresolved'
                    ? `Unresolved: ${visualVerification.remainingIssues?.length || visualVerification.issues?.length || 0} issues remaining after 1 targeted retry`
                    : visualVerification.reason || 'Visual verification'
            }
          >
            {visualVerification.status === 'verified' ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Verified (1440px & 375px)</span>
              </>
            ) : visualVerification.status === 'repaired' ? (
              <>
                <span className="size-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span>Repaired on 2nd Render</span>
              </>
            ) : visualVerification.status === 'unresolved' ? (
              <>
                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Unresolved Visual Defect</span>
              </>
            ) : visualVerification.status === 'unavailable' ? (
              <>
                <span className="size-1.5 rounded-full bg-red-400 shrink-0" />
                <span>Visual QA Unavailable</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-zinc-500 shrink-0" />
                <span>Visual QA {visualVerification.status}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Center Area: Viewport Controls (Desktop, Tablet, Mobile) */}
      <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
        <button
          type="button"
          onClick={() => onChangeDeviceViewport('desktop')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            deviceViewport === 'desktop'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'hover:text-zinc-200'
          }`}
          title="Desktop View (100%)"
        >
          <MonitorIcon size={13} />
          <span className="hidden md:inline text-[11px]">Desktop</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeDeviceViewport('tablet')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            deviceViewport === 'tablet'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'hover:text-zinc-200'
          }`}
          title="Tablet View (768px)"
        >
          <TabletIcon size={13} />
          <span className="hidden md:inline text-[11px]">Tablet</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeDeviceViewport('mobile')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            deviceViewport === 'mobile'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'hover:text-zinc-200'
          }`}
          title="Mobile View (375px)"
        >
          <SmartphoneIcon size={13} />
          <span className="hidden md:inline text-[11px]">Mobile</span>
        </button>
      </div>

      {/* Right Area: Code/Preview Toggle, Open Preview, Publish, Export */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* View Mode Toggle: Preview / Split / Code */}
        <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
          <button
            type="button"
            onClick={() => onToggleViewMode('preview')}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              !showCode
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'hover:text-zinc-200'
            }`}
            title="Preview Only"
          >
            <EyeIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => onToggleViewMode('split')}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              showCode
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'hover:text-zinc-200'
            }`}
            title="Code Editor"
          >
            <Code2Icon size={13} />
          </button>
        </div>

        {/* Open Preview External */}
        <button
          type="button"
          onClick={onOpenPreview}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
          title="Open in new window"
        >
          <ExternalLinkIcon size={13} />
          <span className="hidden md:inline">Preview</span>
        </button>

        {/* Publish */}
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
        >
          {publishing ? (
            <Loader2Icon size={13} className="animate-spin" />
          ) : (
            <GlobeIcon size={13} />
          )}
          <span>Publish</span>
        </button>

        {/* Export ZIP */}
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
          title="Export Project ZIP"
        >
          <DownloadIcon size={13} />
          <span className="hidden lg:inline">Export</span>
        </button>
      </div>
    </header>
  );
};

export default BuilderHeader;
