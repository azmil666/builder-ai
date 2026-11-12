import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, CopyIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const PublishModal = ({ publishUrl, onClose }) => {
  const handleCopyLink = () => {
    if (!publishUrl) return;
    navigator.clipboard.writeText(publishUrl);
    toast.success('Public link copied to clipboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-overlay rounded-2xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] max-w-md w-full p-6 relative"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
        >
          <XIcon size={14} />
        </button>

        <div className="mb-6">
          <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle2Icon size={18} />
          </div>
          <h3 className="font-display text-lg font-medium text-ink mb-1">
            Your website is live
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Anyone with the link below can view your published site.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              Published Link
            </label>
            <input
              type="text"
              readOnly
              value={publishUrl}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-canvas font-mono text-xs text-ink outline-none"
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-ink text-canvas text-xs font-medium hover:bg-white/90 active:scale-95 cursor-pointer rounded-lg transition"
            >
              <CopyIcon size={13} />
              <span>Copy Link</span>
            </button>
            <button
              type="button"
              onClick={() => window.open(publishUrl, '_blank')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border border-white/10 bg-surface-elevated text-ink text-xs font-medium hover:bg-surface-hover active:scale-95 cursor-pointer rounded-lg transition"
            >
              <ExternalLinkIcon size={13} />
              <span>Open Site</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PublishModal;
