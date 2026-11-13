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
import FileCreateModal from './FileCreateModal';
import FileDeleteModal from './FileDeleteModal';
import { isLockedEntryFile, resolveProjectFramework } from '../utils/frameworkUtils';

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
  if (name.endsWith('.css')) return <FileTextIcon size={13} className="text-ink-muted shrink-0" />;
  if (name.endsWith('.jsx') || name.endsWith('.js'))
    return <FileCodeIcon size={13} className="text-ink-secondary shrink-0" />;
  if (name.endsWith('.json'))
    return <FileTextIcon size={13} className="text-ink-muted shrink-0" />;
  if (name.endsWith('.html'))
    return <FileCodeIcon size={13} className="text-ink-secondary shrink-0" />;
  return <FileTextIcon size={13} className="text-ink-muted shrink-0" />;
}

function TreeItem({
  node,
  activeFile,
  framework = 'react',
  onFileSelect,
  onRename,
  onDeleteRequest,
  depth = 0,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const isActive = node.path === activeFile;
  const isLocked = isLockedEntryFile(node.path, framework);

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
          className="flex items-center gap-1.5 py-1 px-2 text-[12px] text-ink-secondary hover:text-ink hover:bg-surface-elevated rounded-md select-none cursor-pointer group transition-colors"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {isOpen ? (
            <ChevronDownIcon size={12} className="text-ink-muted" />
          ) : (
            <ChevronRightIcon size={12} className="text-ink-muted" />
          )}
          {isOpen ? (
            <FolderOpenIcon size={13} className="text-ink-secondary" />
          ) : (
            <FolderIcon size={13} className="text-ink-muted" />
          )}
          <span className="font-medium tracking-tight">{node.name}</span>
        </div>

        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                activeFile={activeFile}
                framework={framework}
                onFileSelect={onFileSelect}
                onRename={onRename}
                onDeleteRequest={onDeleteRequest}
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
      className={`group w-full flex items-center justify-between py-1 px-2 text-[12px] rounded-md cursor-pointer transition-colors ${
        isActive
          ? 'bg-surface-active text-ink font-medium border-l-2 border-ink'
          : 'text-ink-muted hover:bg-surface-elevated hover:text-ink'
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
              className="w-full bg-canvas border border-white/30 rounded px-1.5 py-0.5 text-[12px] text-ink outline-none"
            />
          </form>
        ) : (
          <span className="truncate font-mono text-[11.5px]">{node.name}</span>
        )}
      </div>

      {/* Action buttons on hover */}
      {!isRenaming && (
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          {!isLocked && onRename && (
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover cursor-pointer"
              title="Rename file"
            >
              <PencilIcon size={11} />
            </button>
          )}

          {!isLocked && onDeleteRequest && (
            <button
              type="button"
              onClick={() => onDeleteRequest(node.path)}
              className="p-1 rounded text-ink-muted hover:text-red-400 hover:bg-surface-hover cursor-pointer"
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
  framework = 'react',
  onFileSelect,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const resolvedFramework = framework || resolveProjectFramework(files);
  const allFileKeys = useMemo(() => Object.keys(files || {}), [files]);

  const filteredKeys = useMemo(() => {
    if (!filterQuery.trim()) return allFileKeys;
    const q = filterQuery.toLowerCase().trim();
    return allFileKeys.filter((k) => k.toLowerCase().includes(q));
  }, [allFileKeys, filterQuery]);

  const tree = useMemo(() => buildTree(filteredKeys), [filteredKeys]);

  return (
    <div className="flex flex-col h-full bg-surface text-ink border-r border-white/10">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-canvas/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-medium tracking-tight text-ink">
            Explorer
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-white/10 text-ink-muted">
            {allFileKeys.length}
          </span>
        </div>

        {onCreateFile && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex size-6 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-elevated transition-colors cursor-pointer"
            title="Create new file with template"
          >
            <FilePlusIcon size={14} />
          </button>
        )}
      </div>

      {/* Quick Search */}
      <div className="p-2.5 border-b border-white/10 shrink-0">
        <div className="relative">
          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-surface-elevated border border-white/10 rounded-md pl-7 pr-6 py-1 text-[11px] text-ink placeholder:text-ink-subtle outline-none focus:border-white/25 transition-colors"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
            >
              <XIcon size={11} />
            </button>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 hide-scrollbar">
        {tree.length === 0 && (
          <div className="py-8 text-center text-xs text-ink-muted">
            {filterQuery ? `No files matching "${filterQuery}"` : 'No files in workspace'}
          </div>
        )}

        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            activeFile={activeFile}
            framework={resolvedFramework}
            onFileSelect={onFileSelect}
            onRename={onRenameFile}
            onDeleteRequest={setDeleteTarget}
          />
        ))}
      </div>

      {/* Create File Modal */}
      <FileCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        existingFiles={files}
        framework={resolvedFramework}
        onCreate={onCreateFile}
      />

      {/* Delete File Modal */}
      <FileDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        filePath={deleteTarget}
        onConfirm={onDeleteFile}
      />
    </div>
  );
};

export default FileExplorer;
