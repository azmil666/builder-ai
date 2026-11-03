import React from 'react';
import { AlertTriangleIcon, RotateCcwIcon, ArrowLeftIcon, FileCodeIcon } from 'lucide-react';

export default function GenerationFailureView({
  project,
  onRetry,
  onBack,
  onInspectFiles,
}) {
  const errorMsg = project?.error || 'An unexpected error occurred during build';
  const hasFiles = Object.keys(project?.files || {}).length > 0;
  const isRateLimit =
    errorMsg.includes('429') ||
    errorMsg.toLowerCase().includes('rate limit') ||
    errorMsg.toLowerCase().includes('quota');
  const isHighDemand =
    errorMsg.includes('503') ||
    errorMsg.toLowerCase().includes('unavailable') ||
    errorMsg.toLowerCase().includes('high demand') ||
    errorMsg.toLowerCase().includes('overloaded');

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Status Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangleIcon className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100">
              Website Generation Failed
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              The AI model encountered an issue while generating your project.
            </p>
          </div>
        </div>

        {/* Error Detail Box */}
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 rounded-xl">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
            Failure Reason
          </div>
          <p className="text-sm text-red-200 font-mono break-words leading-relaxed">
            {errorMsg}
          </p>
        </div>

        {/* Advisory Tips for Rate Limits / High Demand */}
        {isRateLimit && (
          <div className="mb-6 p-3.5 bg-amber-950/30 border border-amber-900/40 rounded-xl text-xs text-amber-300/90 leading-relaxed">
            <span className="font-semibold text-amber-200">Rate Limit Advice:</span> Google Gemini reached its request frequency or quota limit. Waiting 30–60 seconds before retrying usually resolves this automatically.
          </div>
        )}

        {isHighDemand && (
          <div className="mb-6 p-3.5 bg-amber-950/30 border border-amber-900/40 rounded-xl text-xs text-amber-300/90 leading-relaxed">
            <span className="font-semibold text-amber-200">Server Capacity Advice:</span> Google AI servers are temporarily experiencing high demand. Please try again shortly.
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-sm cursor-pointer"
            >
              <RotateCcwIcon size={14} />
              Try Again
            </button>
          )}

          {hasFiles && onInspectFiles && (
            <button
              type="button"
              onClick={onInspectFiles}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition cursor-pointer"
            >
              <FileCodeIcon size={14} />
              Inspect Partial Files ({Object.keys(project.files).length})
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition cursor-pointer ml-auto"
            >
              <ArrowLeftIcon size={14} />
              Back to Projects
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

