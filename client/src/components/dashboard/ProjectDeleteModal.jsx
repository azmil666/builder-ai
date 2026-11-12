import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon, Trash2Icon, XIcon } from 'lucide-react';

const ProjectDeleteModal = ({ project, isOpen, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {isOpen && project && (
        <motion.div
          key="project-delete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="project-delete-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md glass-overlay rounded-2xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] p-6 relative overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
          >
            {/* Close icon */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
              aria-label="Close dialog"
            >
              <XIcon size={14} />
            </button>

            {/* Warning Icon */}
            <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangleIcon size={18} />
            </div>

            <h3 id="delete-project-title" className="font-display text-base font-medium text-ink">
              Delete Project
            </h3>

            <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-medium text-ink">&ldquo;{project.name}&rdquo;</span>? All generated files, revisions, and project data will be permanently removed.
            </p>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(project._id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white active:scale-95 transition cursor-pointer"
              >
                <Trash2Icon size={13} />
                <span>Delete Permanently</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProjectDeleteModal;
