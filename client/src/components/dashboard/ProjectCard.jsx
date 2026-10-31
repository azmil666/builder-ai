import React from 'react';
import moment from 'moment';
import {
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LayersIcon,
  Loader2Icon,
  Trash2Icon,
} from 'lucide-react';
import ProjectPreviewPlaceholder from './ProjectPreviewPlaceholder';

const ProjectCard = ({
  project,
  onOpen,
  onPreview,
  onCopyLink,
  onDelete,
  viewMode = 'grid',
}) => {
  const isPublished = Boolean(project?.published);
  const status = project?.status || (project?.files && Object.keys(project.files).length > 0 ? 'completed' : 'pending');
  const isGenerating = status === 'generating' || status === 'pending';
  const isRevising = status === 'revising';
  const archetype = project?.designSpec?.archetype;

  // List View Mode
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpen(project._id)}
        className="group w-full bg-zinc-900/60 hover:bg-zinc-850/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all duration-150"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-10 rounded-lg bg-zinc-800 border border-zinc-750 flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors">
            <LayersIcon size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white">
                {project.name || 'Untitled Project'}
              </h4>
              {isPublished && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Published
                </span>
              )}
              {isGenerating && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <Loader2Icon size={10} className="animate-spin" /> Generating
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <ClockIcon size={12} className="text-zinc-500" />
                {moment(project.updatedAt || project.createdAt).fromNow()}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="font-mono text-zinc-400">v{project.version || 1}</span>
              {archetype && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400 capitalize">{archetype.replace('-', ' ')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-1 self-end sm:self-center shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onPreview(project)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            title={isPublished ? 'View Published Website' : 'Preview in New Window'}
          >
            {isPublished ? <GlobeIcon size={15} /> : <ExternalLinkIcon size={15} />}
          </button>

          <button
            type="button"
            onClick={() => onCopyLink(project)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            title="Copy Project Link"
          >
            <CopyIcon size={15} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(project)}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
            title="Delete Project"
          >
            <Trash2Icon size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Grid View Mode (Default)
  return (
    <div
      onClick={() => onOpen(project._id)}
      className="group flex flex-col bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-200 cursor-pointer"
    >
      {/* Visual Thumbnail */}
      <ProjectPreviewPlaceholder project={project} />

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-white line-clamp-1">
              {project.name || 'Untitled Project'}
            </h4>
            {isPublished ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            ) : isGenerating ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Loader2Icon size={10} className="animate-spin" /> Building
              </span>
            ) : isRevising ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                Revising
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-750 shrink-0">
                Draft
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {project.description || 'No description provided.'}
          </p>
        </div>

        {/* Footer Meta & Actions */}
        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <ClockIcon size={11} className="text-zinc-500" />
            {moment(project.updatedAt || project.createdAt).fromNow()}
          </span>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onPreview(project)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              title={isPublished ? 'View Live' : 'Open Preview'}
            >
              <ExternalLinkIcon size={13} />
            </button>

            <button
              type="button"
              onClick={() => onCopyLink(project)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              title="Copy Link"
            >
              <CopyIcon size={13} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(project)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              title="Delete Project"
            >
              <Trash2Icon size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;

