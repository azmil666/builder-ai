import React, { useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

function buildTree(paths) {
  const root = [];
  for (const filePath of paths.sort()) {
    const parts = filePath.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = '/' + parts.slice(0, i + 1).join('/');
      let existing = current.find((n) => n.name === name);
      if (!existing) {
        existing = {
          name,
          path: fullPath,
          isDir: !isLast,
          children: [],
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }
  return root;
}

function getFileIcon(name) {
  if (name.endsWith('.css')) return <FileTextIcon size={13} className="text-sky-400 shrink-0" />;
  if (name.endsWith('.jsx') || name.endsWith('.js'))
    return <FileCodeIcon size={13} className="text-amber-400 shrink-0" />;
  if (name.endsWith('.json'))
    return <FileTextIcon size={13} className="text-emerald-400 shrink-0" />;
  if (name.endsWith('.html'))
    return <FileCodeIcon size={13} className="text-orange-400 shrink-0" />;
  return <FileTextIcon size={13} className="text-zinc-400 shrink-0" />;
}

function TreeItem({
  node,
  activeFile,
  onFileSelect,
  onRename,
  onDelete,
  depth = 0,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const isActive = node.path === activeFile;

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.name) {
      setIsRenaming(false);
      return;
    }
    const dirParts = node.path.split('/').slice(0, -1);
    const newPath = [...dirParts, trimmed].join('/');
    onRename(node.path, newPath);
    setIsRenaming(false);
  };

  if (node.isDir) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md select-none cursor-pointer group transition-colors"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {isOpen ? (
            <ChevronDownIcon size={12} className="text-zinc-500" />
          ) : (
            <ChevronRightIcon size={12} className="text-zinc-500" />
          )}
          {isOpen ? (
            <FolderOpenIcon size={13} className="text-indigo-400/80" />
          ) : (
            <FolderIcon size={13} className="text-zinc-500" />
          )}
          <span className="font-medium text-zinc-300">{node.name}</span>
        </div>

        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onRename={onRename}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group w-full flex items-center justify-between py-1.5 px-2 text-xs rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-zinc-800 text-white font-medium border-l-2 border-indigo-500'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
      onClick={() => onFileSelect(node.path)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {getFileIcon(node.name)}
        {isRenaming ? (
          <form
            onSubmit={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1"
          >
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              autoFocus
              className="w-full bg-zinc-950 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
            />
          </form>
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* Action buttons on hover */}
      {!isRenaming && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          {node.path !== '/App.js' && onRename && (
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Rename file"
            >
              <PencilIcon size={11} />
            </button>
          )}

          {node.path !== '/App.js' && node.path !== '/styles.css' && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(node.path)}
              className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
              title="Delete file"
            >
              <Trash2Icon size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const FileExplorer = ({
  files = {},
  activeFile,
  onFileSelect,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  const allFileKeys = useMemo(() => Object.keys(files || {}), [files]);

  const filteredKeys = useMemo(() => {
    if (!filterQuery.trim()) return allFileKeys;
    const q = filterQuery.toLowerCase().trim();
    return allFileKeys.filter((k) => k.toLowerCase().includes(q));
  }, [allFileKeys, filterQuery]);

  const tree = useMemo(() => buildTree(filteredKeys), [filteredKeys]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const trimmed = newFilePath.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (!/\.(js|jsx|css|json)$/.test(cleanPath)) {
      toast.error('File must end in .jsx, .js, .css, or .json');
      return;
    }
    onCreateFile(cleanPath);
    setNewFilePath('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 border-r border-zinc-850">
      {/* Top Header */}
      <div className="px-3 py-2.5 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-950/80">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Files
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
            {allFileKeys.length}
          </span>
        </div>

        {onCreateFile && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            title="Create new file"
          >
            <FilePlusIcon size={14} />
          </button>
        )}
      </div>

      {/* Quick Search */}
      <div className="p-2 border-b border-zinc-850/60 shrink-0">
        <div className="relative">
          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg pl-7 pr-6 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-700 transition"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <XIcon size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Inline Create Input */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-zinc-800 bg-zinc-900/60">
          <div className="text-[10px] text-zinc-400 mb-1 flex items-center justify-between">
            <span>New File Path:</span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            placeholder="/components/Hero.jsx"
            autoFocus
            className="w-full bg-zinc-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none"
          />
        </form>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 hide-scrollbar">
        {tree.length === 0 && (
          <div className="py-8 text-center text-xs text-zinc-500">
            {filterQuery ? `No files matching "${filterQuery}"` : 'No files in workspace'}
          </div>
        )}

        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            onRename={onRenameFile}
            onDelete={onDeleteFile}
          />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
