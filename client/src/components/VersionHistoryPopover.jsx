import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  FileTextIcon,
  HistoryIcon,
  Loader2Icon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react';
import moment from 'moment';
import { useAppContext } from '../context/useAppContext.js';

const VersionHistoryPopover = ({
  projectId,
  currentVersion = 1,
  isOpen,
  onClose,
}) => {
  const { fetchProjectVersions, restoreProjectVersion } = useAppContext();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [confirmVersion, setConfirmVersion] = useState(null);
  const popoverRef = useRef(null);

  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await fetchProjectVersions(projectId);
      setVersions(list);
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchProjectVersions]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
      setConfirmVersion(null);
    }
  }, [isOpen, loadVersions]);

  // Handle click outside and Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleRestore = async (version) => {
    if (restoringVersion !== null) return;
    setRestoringVersion(version);
    try {
      await restoreProjectVersion(projectId, version);
      setConfirmVersion(null);
      // Refresh version list to show the new restore snapshot
      await loadVersions();
    } catch {
      // Error notification handled in restoreProjectVersion
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-sm sm:w-96 rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] z-50 overflow-hidden flex flex-col text-ink"
      role="dialog"
      aria-label="Version History"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/10 bg-surface-elevated/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-surface border border-white/10 flex items-center justify-center text-ink-secondary shrink-0">
            <HistoryIcon size={13} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-xs font-semibold text-ink tracking-tight">
                Version History
              </h3>
              {!loading && versions.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-white/10 text-ink-muted">
                  {versions.length}
                </span>
              )}
            </div>
            <p className="text-[10px] text-ink-muted font-sans">
              Browse snapshots and restore past versions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="size-6 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-elevated transition-colors cursor-pointer"
          title="Close version history"
        >
          <XIcon size={13} />
        </button>
      </div>

      {/* Snapshot List Content */}
      <div className="max-h-[360px] overflow-y-auto p-2.5 space-y-2">
        {loading ? (
          // Skeleton loader
          <div className="space-y-2 p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-white/5 bg-white/5 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-12 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
                <div className="h-3 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : versions.length === 0 ? (
          // Empty state
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="size-9 rounded-xl bg-surface-elevated border border-white/10 flex items-center justify-center text-ink-muted mb-2.5">
              <ClockIcon size={16} />
            </div>
            <p className="text-xs font-medium text-ink mb-1">
              No snapshots recorded yet
            </p>
            <p className="text-[11px] text-ink-muted max-w-[240px] leading-relaxed">
              Snapshots are captured automatically when generation completes and after each successful revision.
            </p>
          </div>
        ) : (
          // List of versions
          versions.map((item) => {
            const isCurrent = item.version === currentVersion;
            const isConfirming = confirmVersion === item.version;
            const isRestoring = restoringVersion === item.version;

            return (
              <div
                key={item.version}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                    : 'border-white/5 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-white/10'
                }`}
              >
                {/* Header Row: Version badge, Current badge, Timestamp */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-white/10 text-ink">
                      v{item.version}
                    </span>

                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Current
                      </span>
                    )}
                  </div>

                  <span
                    className="text-[10px] font-mono text-ink-muted shrink-0"
                    title={item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  >
                    {item.createdAt ? moment(item.createdAt).fromNow() : ''}
                  </span>
                </div>

                {/* Prompt / Label Description */}
                <p
                  className="text-xs text-ink-secondary line-clamp-2 leading-relaxed mb-2.5"
                  title={item.label}
                >
                  {item.label || 'Snapshot'}
                </p>

                {/* Footer Row: File Count & Restore Action */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-muted">
                    <FileTextIcon size={11} />
                    {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                  </span>

                  {isCurrent ? (
                    <span className="text-[10px] font-mono text-ink-subtle">
                      Active
                    </span>
                  ) : isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-amber-300">
                        Confirm?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestore(item.version)}
                        disabled={restoringVersion !== null}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-ink hover:bg-white/90 text-canvas flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isRestoring ? (
                          <Loader2Icon size={10} className="animate-spin" />
                        ) : (
                          <RotateCcwIcon size={10} />
                        )}
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmVersion(null)}
                        disabled={restoringVersion !== null}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmVersion(item.version)}
                      disabled={restoringVersion !== null}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-surface border border-white/10 hover:border-white/20 text-ink-secondary hover:text-ink hover:bg-surface-active transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RotateCcwIcon size={11} />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3.5 py-2 border-t border-white/10 bg-surface-elevated/20 text-[10px] font-mono text-ink-subtle flex items-center justify-between">
        <span>Max 15 snapshots preserved</span>
        <span>Point-in-time rollback</span>
      </div>
    </motion.div>
  );
};

export default VersionHistoryPopover;
