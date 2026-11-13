import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Code2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2Icon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
} from 'lucide-react';
import VersionHistoryPopover from './VersionHistoryPopover';

const BuilderHeader = ({
  projectId,
  projectName,
  version = 1,
  isOngoing = false,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 bg-canvas/90 backdrop-blur-xl text-ink z-30 select-none">
      {/* Left Area: Back, Logo, Project Name, Version, Sync */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <button
          onClick={onBack}
          type="button"
          className="flex size-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated transition-colors cursor-pointer"
          title="Back to Dashboard"
        >
          <ArrowLeftIcon size={14} />
        </button>

        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-surface-elevated border border-white/10 flex items-center justify-center shrink-0">
            <img src="/logo.svg" alt="Builder AI" className="size-3.5 invert" />
          </div>
          <span className="hidden md:inline font-display font-medium text-xs tracking-tight text-ink-secondary">
            Builder AI
          </span>
          <span className="hidden md:inline text-ink-subtle">/</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-xs sm:text-sm font-medium text-ink truncate max-w-[130px] sm:max-w-[200px] md:max-w-[280px]">
            {projectName || 'Untitled Project'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-white/10 text-ink-muted shrink-0">
            v{version}
          </span>
        </div>

        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 text-[11px] font-mono text-ink-muted">
          {syncStatus === 'saving' ? (
            <>
              <Loader2Icon size={12} className="animate-spin text-ink-secondary" />
              <span className="text-ink-secondary">Saving...</span>
            </>
          ) : syncStatus === 'error' ? (
            <span className="text-red-400">Sync Error</span>
          ) : (
            <>
              <CheckCircle2Icon size={12} className="text-ink-muted" />
              <span>Saved</span>
            </>
          )}
        </div>

        {/* Post-Generation Visual Verification Status Outcome */}
        {visualVerification && visualVerification.status && (
          <div
            className={`hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border transition ${
              visualVerification.status === 'verified'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : visualVerification.status === 'repaired'
                  ? 'bg-surface-elevated text-ink-secondary border-white/15'
                  : visualVerification.status === 'unresolved'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-surface-elevated text-ink-muted border-white/10'
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
                <span className="size-1.5 rounded-full bg-ink shrink-0" />
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
                <span className="size-1.5 rounded-full bg-ink-muted shrink-0" />
                <span>Visual QA {visualVerification.status}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Center Area: Viewport Controls (Desktop, Tablet, Mobile) */}
      <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-surface border border-white/10 text-ink-muted">
        {[
          { key: 'desktop', label: 'Desktop', icon: MonitorIcon, title: 'Desktop View (100%)' },
          { key: 'tablet', label: 'Tablet', icon: TabletIcon, title: 'Tablet View (768px)' },
          { key: 'mobile', label: 'Mobile', icon: SmartphoneIcon, title: 'Mobile View (375px)' },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = deviceViewport === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChangeDeviceViewport(item.key)}
              className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isActive ? 'text-ink' : 'hover:text-ink-secondary'
              }`}
              title={item.title}
            >
              {isActive && (
                <motion.span
                  layoutId="viewport-active-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-md bg-surface-active border border-white/10"
                />
              )}
              <Icon size={13} className="relative z-10" />
              <span className="relative z-10 hidden md:inline text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Area: Code/Preview Toggle, Open Preview, Publish, Export */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* View Mode Toggle: Preview / Code */}
        <div className="flex items-center p-0.5 rounded-lg bg-surface border border-white/10 text-ink-muted">
          <button
            type="button"
            onClick={() => onToggleViewMode('preview')}
            className={`relative p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              !showCode ? 'text-ink' : 'hover:text-ink-secondary'
            }`}
            title="Preview Only"
          >
            {!showCode && (
              <motion.span
                layoutId="viewmode-active-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-md bg-surface-active border border-white/10"
              />
            )}
            <EyeIcon size={14} className="relative z-10" />
          </button>

          <button
            type="button"
            onClick={() => onToggleViewMode('split')}
            className={`relative p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              showCode ? 'text-ink' : 'hover:text-ink-secondary'
            }`}
            title="Code Editor"
          >
            {showCode && (
              <motion.span
                layoutId="viewmode-active-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-md bg-surface-active border border-white/10"
              />
            )}
            <Code2Icon size={14} className="relative z-10" />
          </button>
        </div>

        {/* Open Preview External */}
        <button
          type="button"
          onClick={onOpenPreview}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-surface hover:bg-surface-elevated text-ink-secondary hover:text-ink text-xs font-medium transition-colors cursor-pointer"
          title="Open in new window"
        >
          <ExternalLinkIcon size={13} />
          <span className="hidden md:inline">Preview</span>
        </button>

        {/* Version History Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            disabled={isOngoing}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              historyOpen
                ? 'border-white/20 bg-surface-active text-ink'
                : 'border-white/10 bg-surface hover:bg-surface-elevated text-ink-secondary hover:text-ink'
            }`}
            title={
              isOngoing
                ? 'Version history is unavailable while project is generating or revising'
                : 'Version History & Rollback'
            }
          >
            <HistoryIcon size={13} />
            <span className="hidden lg:inline">History</span>
          </button>

          <AnimatePresence>
            {historyOpen && (
              <VersionHistoryPopover
                projectId={projectId}
                currentVersion={version}
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Export ZIP */}
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-surface hover:bg-surface-elevated text-ink-secondary hover:text-ink text-xs font-medium transition-colors cursor-pointer"
          title="Export Project ZIP"
        >
          <DownloadIcon size={13} />
          <span className="hidden lg:inline">Export</span>
        </button>

        {/* Publish */}
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink hover:bg-white/90 text-canvas text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {publishing ? (
            <Loader2Icon size={13} className="animate-spin" />
          ) : (
            <GlobeIcon size={13} />
          )}
          <span>Publish</span>
        </button>
      </div>
    </header>
  );
};

export default BuilderHeader;
