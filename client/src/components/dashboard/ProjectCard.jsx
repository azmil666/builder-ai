import React from 'react';
import moment from 'moment';
import { motion } from 'framer-motion';
import {
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LayersIcon,
  Loader2Icon,
  Trash2Icon,
} from 'lucide-react';
import ProjectPreviewPlaceholder from './ProjectPreviewPlaceholder';

const cardTransition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
};

const StatusBadge = ({ isPublished, isGenerating, isRevising }) => {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }
  if (isGenerating) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-secondary">
        <Loader2Icon size={10} className="animate-spin" />
        Building
      </span>
    );
  }
  if (isRevising) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Revising
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
      Draft
    </span>
  );
};

const ProjectCard = ({
  project,
  onOpen,
  onPreview,
  onCopyLink,
  onDelete,
  viewMode = 'grid',
}) => {
  const isPublished = Boolean(project?.published);
  const status =
    project?.status ||
    (project?.files && Object.keys(project.files).length > 0 ? 'completed' : 'pending');
  const isGenerating = status === 'generating' || status === 'pending';
  const isRevising = status === 'revising';
  const timeAgo = moment(project.updatedAt || project.createdAt).fromNow();

  // List View Mode
  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        whileHover={{ x: 2 }}
        transition={cardTransition}
        onClick={() => onOpen(project._id)}
        className="group flex w-full items-center justify-between gap-4 rounded-xl border border-hairline bg-surface/60 px-4 py-3.5 transition-colors hover:border-hairline-strong hover:bg-surface-elevated cursor-pointer"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-elevated text-ink-muted transition-colors group-hover:text-ink">
            <LayersIcon size={16} />
          </div>

          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-medium text-ink">
              {project.name || 'Untitled Project'}
            </h4>
            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-ink-muted">
              <StatusBadge
                isPublished={isPublished}
                isGenerating={isGenerating}
                isRevising={isRevising}
              />
              <span className="text-ink-subtle">·</span>
              <span className="font-mono text-[11px]">{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Hover-revealed Quick Actions */}
        <div
          className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 relative z-20 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onPreview(project)}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
            title={isPublished ? 'View Published Website' : 'Open Preview'}
          >
            {isPublished ? <GlobeIcon size={14} /> : <ExternalLinkIcon size={14} />}
          </button>

          <button
            type="button"
            onClick={() => onCopyLink(project)}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
            title="Copy Project Link"
          >
            <CopyIcon size={14} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(project)}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-red-400 cursor-pointer"
            title="Delete Project"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  // Grid View Mode (Minimalist Notion-inspired Card)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={cardTransition}
      onClick={() => onOpen(project._id)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface/70 transition-colors hover:border-hairline-strong hover:bg-surface-elevated cursor-pointer"
    >
      {/* Visual Thumbnail */}
      <div className="relative overflow-hidden">
        <ProjectPreviewPlaceholder project={project} />

        {/* Quick Actions Overlay on Hover */}
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full glass-overlay px-1.5 py-1 opacity-100 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 focus-within:opacity-100 transition-all duration-200 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onPreview(project)}
            className="flex size-7 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-white/10 hover:text-ink cursor-pointer"
            title={isPublished ? 'View Live' : 'Open Preview'}
          >
            <ExternalLinkIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => onCopyLink(project)}
            className="flex size-7 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-white/10 hover:text-ink cursor-pointer"
            title="Copy Link"
          >
            <CopyIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(project)}
            className="flex size-7 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-white/10 hover:text-red-400 cursor-pointer"
            title="Delete Project"
          >
            <Trash2Icon size={13} />
          </button>
        </div>
      </div>

      {/* Minimalist Card Footer: Essential Metadata Only (Title, Status, Time) */}
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="truncate font-display text-sm font-medium text-ink">
            {project.name || 'Untitled Project'}
          </h4>
          <StatusBadge
            isPublished={isPublished}
            isGenerating={isGenerating}
            isRevising={isRevising}
          />
        </div>

        <span className="font-mono text-[11px] text-ink-muted">
          Updated {timeAgo}
        </span>
      </div>
    </motion.div>
  );
};

export default ProjectCard;
