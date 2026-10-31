import React from 'react';
import { AlertTriangleIcon, Trash2Icon, XIcon } from 'lucide-react';

export default function FileDeleteModal({
  isOpen,
  onClose,
  filePath,
  onConfirm,
}) {
  if (!isOpen || !filePath) return null;

  const fileName = filePath.split('/').pop();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
        >
          <XIcon size={16} />
        </button>

        <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertTriangleIcon size={18} />
        </div>

        <h3 className="text-base font-semibold text-zinc-100">Delete File</h3>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          Are you sure you want to permanently delete{' '}
          <span className="font-mono font-semibold text-zinc-200">{fileName}</span> (
          <span className="font-mono text-zinc-400">{filePath}</span>)? This action will remove the file from your project bundle.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(filePath);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition shadow-sm cursor-pointer"
          >
            <Trash2Icon size={13} />
            <span>Delete File</span>
          </button>
        </div>
      </div>
    </div>
  );
}

