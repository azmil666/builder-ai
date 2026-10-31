import React, { useState } from 'react';
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

  const handleNameSave = (e) => {
    e.preventDefault();
    if (name.trim() && name !== project.name) {
      onUpdateName(name.trim());
    }
    setIsEditing(false);
  };

  const isPublished = Boolean(project?.published);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 border-r border-zinc-850 overflow-y-auto p-4 space-y-5 hide-scrollbar">
      {/* Header */}
      <div className="border-b border-zinc-850 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon size={14} className="text-zinc-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Project Settings
          </h3>
        </div>
        <p className="text-[11px] text-zinc-500">
          Configuration & metadata
        </p>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400 block">
          Project Name
        </label>
        {isEditing ? (
          <form onSubmit={handleNameSave} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-900 border border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
            >
              <CheckIcon size={13} />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-xs font-medium text-white truncate">{project?.name}</span>
            <button
              onClick={() => setIsEditing(true)}
              type="button"
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
              title="Rename project"
            >
              <PencilIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Metadata Overview */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Project ID</span>
          <span className="font-mono text-[11px] text-zinc-400">{project?._id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Current Version</span>
          <span className="font-mono text-zinc-300">v{project?.version || 1}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Total Files</span>
          <span className="font-mono text-zinc-300">
            {Object.keys(project?.files || {}).length} files
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Publish Status</span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              isPublished ? 'text-emerald-400' : 'text-zinc-400'
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
      <div className="pt-4 border-t border-zinc-900 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <AlertTriangleIcon size={13} />
          <span>Danger Zone</span>
        </div>

        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
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
