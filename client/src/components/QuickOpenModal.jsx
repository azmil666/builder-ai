import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileCodeIcon,
  FileTextIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';

function getFileIcon(name) {
  if (name.endsWith('.css')) return <FileTextIcon size={14} className="text-ink-muted shrink-0" />;
  if (name.endsWith('.jsx') || name.endsWith('.js'))
    return <FileCodeIcon size={14} className="text-ink-secondary shrink-0" />;
  if (name.endsWith('.json'))
    return <FileTextIcon size={14} className="text-ink-muted shrink-0" />;
  return <FileTextIcon size={14} className="text-ink-muted shrink-0" />;
}

export default function QuickOpenModal({
  isOpen,
  onClose,
  files = {},
  onSelectFile,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const fileList = useMemo(() => Object.keys(files || {}).sort(), [files]);

  const filtered = useMemo(() => {
    if (!query.trim()) return fileList;
    const q = query.toLowerCase().trim();
    return fileList.filter((f) => f.toLowerCase().includes(q));
  }, [fileList, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectFile(filtered[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="quick-open-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="quick-open-dialog"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="w-full max-w-lg glass-overlay rounded-2xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] overflow-hidden select-none"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Spotlight Search Header */}
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center gap-3">
              <SearchIcon size={16} className="text-ink-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Jump to file (e.g. /components/Hero.jsx)..."
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle outline-none"
              />
              <button
                onClick={onClose}
                type="button"
                className="flex size-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
              >
                <XIcon size={14} />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto p-2 space-y-0.5 hide-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-ink-muted">
                  No files match &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((path, idx) => {
                  const isSelected = idx === selectedIndex;
                  const fileName = path.split('/').pop();
                  return (
                    <div
                      key={path}
                      onClick={() => {
                        onSelectFile(path);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-surface-active text-ink border border-white/15'
                          : 'text-ink-secondary border border-transparent hover:bg-surface-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {getFileIcon(path)}
                        <span className="font-medium text-ink">{fileName}</span>
                        <span className="font-mono text-[11px] text-ink-muted truncate">{path}</span>
                      </div>

                      <span className="text-[10px] font-mono text-ink-muted uppercase shrink-0 ml-2">
                        {path.split('.').pop()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Hints */}
            <div className="px-4 py-2.5 bg-canvas/60 border-t border-white/10 flex items-center justify-between text-[11px] text-ink-muted font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>Esc Close</span>
              </div>
              <span>{filtered.length} files</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
