import React from 'react';
import { AlertTriangleIcon, Trash2Icon, XIcon } from 'lucide-react';

const ProjectDeleteModal = ({ project, isOpen, onClose, onConfirm }) => {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
      >
        {/* Close icon */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          aria-label="Close dialog"
        >
          <XIcon size={16} />
        </button>

        {/* Warning Icon */}
        <div className="size-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertTriangleIcon size={20} />
        </div>

        <h3 id="delete-project-title" className="text-lg font-semibold text-zinc-100">
          Delete Project
        </h3>

        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-zinc-200">"{project.name}"</span>? All generated files, revisions, and project data will be permanently removed.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(project._id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition shadow-sm cursor-pointer"
          >
            <Trash2Icon size={14} />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDeleteModal;

