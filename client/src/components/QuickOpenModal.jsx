import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileCodeIcon,
  FileTextIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';

function getFileIcon(name) {
  if (name.endsWith('.css')) return <FileTextIcon size={14} className="text-sky-400 shrink-0" />;
  if (name.endsWith('.jsx') || name.endsWith('.js'))
    return <FileCodeIcon size={14} className="text-amber-400 shrink-0" />;
  if (name.endsWith('.json'))
    return <FileTextIcon size={14} className="text-emerald-400 shrink-0" />;
  return <FileTextIcon size={14} className="text-zinc-400 shrink-0" />;
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Search Header */}
        <div className="p-3.5 border-b border-zinc-800 flex items-center gap-3">
          <SearchIcon size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by path (e.g. /components/Hero.jsx)..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1 hide-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No files match "{query}"
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
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                      : 'text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileIcon(path)}
                    <span className="font-semibold text-zinc-100">{fileName}</span>
                    <span className="text-[11px] text-zinc-500 truncate">{path}</span>
                  </div>

                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    {path.split('.').pop()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-3.5 py-2 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
          </div>
          <span>{filtered.length} files</span>
        </div>
      </div>
    </div>
  );
}
