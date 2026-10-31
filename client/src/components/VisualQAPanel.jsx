import React, { useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileCodeIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Wand2Icon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/api';

export default function VisualQAPanel({
  projectId,
  onApplyFix,
  onFileSelect,
}) {
  const [loading, setLoading] = useState(false);
  const [qaData, setQaData] = useState(null);
  const [applyingFix, setApplyingFix] = useState(false);

  const runAudit = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/projects/${projectId}/qa`);
      setQaData(data);
      if (data.qaReport.summary.totalIssues === 0) {
        toast.success('Visual QA passed with 0 defects!');
      } else {
        toast(`${data.qaReport.summary.totalIssues} visual defects detected`, { icon: '⚠️' });
      }
    } catch (err) {
      console.error('Visual QA check failed:', err);
      toast.error('Failed to run Visual QA audit');
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!qaData?.fixPrompt || applyingFix) return;
    setApplyingFix(true);
    try {
      await onApplyFix(qaData.fixPrompt);
      toast.success('Targeted visual fixes submitted to AI');
    } catch (err) {
      console.error('Failed to apply QA fixes:', err);
    } finally {
      setApplyingFix(false);
    }
  };

  const report = qaData?.qaReport;
  const issues = report?.issues || [];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 border-r border-zinc-850 overflow-y-auto p-4 space-y-5 hide-scrollbar">
      {/* Header */}
      <div className="border-b border-zinc-850 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon size={14} className="text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Visual QA Engine
            </h3>
          </div>
          <p className="text-[11px] text-zinc-400">
            Automated responsive & layout verification
          </p>
        </div>

        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2Icon size={12} className="animate-spin" />
          ) : (
            <RefreshCwIcon size={12} />
          )}
          <span>{qaData ? 'Re-Audit' : 'Run Audit'}</span>
        </button>
      </div>

      {!qaData && !loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="size-11 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center">
            <EyeIcon size={20} />
          </div>
          <h4 className="text-sm font-medium text-zinc-200">No QA Audit Performed</h4>
          <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
            Click "Run Audit" to scan your project for horizontal overflow, mobile responsive failures, broken assets, and accessibility issues.
          </p>
        </div>
      )}

      {/* Summary Card */}
      {report && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              report.summary.critical === 0 && report.summary.warnings === 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-zinc-900/90 border-zinc-800 text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {report.summary.critical === 0 && report.summary.warnings === 0 ? (
                <CheckCircle2Icon size={22} className="text-emerald-400" />
              ) : (
                <AlertTriangleIcon size={22} className="text-amber-400" />
              )}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider">
                  {report.summary.critical === 0 && report.summary.warnings === 0
                    ? 'Visual QA Passed'
                    : `${report.summary.totalIssues} Issues Identified`}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {report.summary.critical} critical · {report.summary.warnings} warnings
                </p>
              </div>
            </div>

            {issues.length > 0 && (
              <button
                type="button"
                onClick={handleFix}
                disabled={applyingFix}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {applyingFix ? (
                  <Loader2Icon size={12} className="animate-spin text-zinc-950" />
                ) : (
                  <Wand2Icon size={12} className="text-zinc-950" />
                )}
                <span>1-Click Fix</span>
              </button>
            )}
          </div>

          {/* Category Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-[10px] text-zinc-500 block">Overflow & Clipping</span>
              <span className="font-mono text-sm font-semibold text-zinc-200">
                {report.summary.categories.overflow}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-[10px] text-zinc-500 block">Responsive Layout</span>
              <span className="font-mono text-sm font-semibold text-zinc-200">
                {report.summary.categories.responsive}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-[10px] text-zinc-500 block">Assets & URLs</span>
              <span className="font-mono text-sm font-semibold text-zinc-200">
                {report.summary.categories.assets}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-[10px] text-zinc-500 block">Accessibility</span>
              <span className="font-mono text-sm font-semibold text-zinc-200">
                {report.summary.categories.accessibility}
              </span>
            </div>
          </div>

          {/* Issues List */}
          <div className="space-y-2.5 pt-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Detected Defects ({issues.length})
            </span>

            {issues.map((iss, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                        iss.severity === 'critical'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {iss.severity}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 capitalize">
                      {iss.category}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onFileSelect(iss.file)}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-mono transition cursor-pointer"
                  >
                    <FileCodeIcon size={11} />
                    <span>{iss.file.split('/').pop()}:{iss.line}</span>
                  </button>
                </div>

                <p className="text-zinc-200 text-xs leading-relaxed">{iss.message}</p>

                {iss.suggestedFix && (
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850 text-[11px] text-zinc-400">
                    <span className="text-indigo-400 font-semibold">Fix: </span>
                    <span>{iss.suggestedFix}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
