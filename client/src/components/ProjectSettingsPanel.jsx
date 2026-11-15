import React, { useState, useEffect } from 'react';
import {
  AlertTriangleIcon,
  CheckIcon,
  GlobeIcon,
  PencilIcon,
  SettingsIcon,
  Trash2Icon,
} from 'lucide-react';

export default function ProjectSettingsPanel({
  project,
  onUpdateName,
  onDelete,
}) {
  const [name, setName] = useState(project?.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(project?.name || '');
  }, [project?.name]);

  const handleNameSave = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== project?.name) {
      setIsSaving(true);
      try {
        await onUpdateName(trimmed);
      } finally {
        setIsSaving(false);
        setIsEditing(false);
      }
    } else {
      setName(project?.name || '');
      setIsEditing(false);
    }
  };

  const isPublished = Boolean(project?.published);

  return (
    <div className="flex flex-col h-full bg-surface text-ink border-r border-hairline overflow-y-auto p-4 space-y-5 hide-scrollbar">
      {/* Header */}
      <div className="border-b border-hairline pb-3">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon size={14} className="text-ink-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Project Settings
          </h3>
        </div>
        <p className="text-[11px] text-ink-muted">
          Configuration & metadata
        </p>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-ink-secondary block">
          Project Name
        </label>
        {isEditing ? (
          <form onSubmit={handleNameSave} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
              className="flex-1 bg-surface-elevated border border-hairline focus:border-white/30 rounded-lg px-3 py-1.5 text-xs text-ink outline-none disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-ink text-canvas hover:bg-white/90 disabled:opacity-50 text-xs font-medium cursor-pointer transition-colors"
            >
              <CheckIcon size={13} />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated border border-hairline">
            <span className="text-xs font-medium text-ink truncate">{project?.name}</span>
            <button
              onClick={() => {
                setName(project?.name || '');
                setIsEditing(true);
              }}
              type="button"
              className="p-1 rounded text-ink-muted hover:text-ink transition cursor-pointer"
              title="Rename project"
            >
              <PencilIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Metadata Overview */}
      <div className="p-3.5 rounded-xl bg-surface-elevated border border-hairline space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Project ID</span>
          <span className="font-mono text-[11px] text-ink-secondary">{project?._id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Current Version</span>
          <span className="font-mono text-ink">v{project?.version || 1}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Total Files</span>
          <span className="font-mono text-ink">
            {Object.keys(project?.files || {}).length} files
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Publish Status</span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              isPublished ? 'text-emerald-400' : 'text-ink-muted'
            }`}
          >
            {isPublished ? (
              <>
                <GlobeIcon size={11} /> Published
              </>
            ) : (
              'Draft'
            )}
          </span>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-hairline space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <AlertTriangleIcon size={13} />
          <span>Danger Zone</span>
        </div>

        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Deleting this project permanently removes all files, history, and published links.
          </p>
          <button
            onClick={() => onDelete(project)}
            type="button"
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-medium transition cursor-pointer"
          >
            <Trash2Icon size={13} />
            <span>Delete This Project</span>
          </button>
        </div>
      </div>
    </div>
  );
}
