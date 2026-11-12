import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2Icon,
  CircleIcon,
  CpuIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import { useAppContext } from "../context/useAppContext";
import VisualVerificationRunner from "./VisualVerificationRunner";

const PHASES = [
  { id: "pending", label: "Architect" },
  { id: "generating", label: "Generate" },
  { id: "validating", label: "Validate" },
  { id: "visual_verifying", label: "Verify" },
];

export default function AgentProgressDashboard({ project }) {
  const { reportVisualVerification } = useAppContext();
  const planned = project.filesPlanned || [];
  const completed = project.filesGenerated || [];
  const current = project.currentFile;
  const isFailed = project.status === "failed";
  const isVisualVerifying = project.status === "visual_verifying";
  const isRepairing = project.status === "repairing";

  const [verificationProgress, setVerificationProgress] = useState({
    desktop: "pending",
    mobile: "pending",
    round: 1,
  });

  const handleProgressUpdate = ({ completedViewport, round }) => {
    setVerificationProgress((prev) => ({
      ...prev,
      [completedViewport]: "passed",
      round,
    }));
  };

  const activePhaseIndex = isVisualVerifying || isRepairing
    ? 3
    : project.status === "validating"
      ? 2
      : project.status === "generating"
        ? 1
        : 0;

  const progressPercent =
    planned.length > 0 ? Math.round((completed.length / planned.length) * 100) : 0;

  const phaseTitle = isFailed
    ? "Generation Failed"
    : isVisualVerifying
      ? "Visually Verifying Layout"
      : isRepairing
        ? "AI Self-Repairing Viewport"
        : project.status === "validating"
          ? "Validating Code & Contracts"
          : project.status === "pending"
            ? "Planning Architecture"
            : "Building React Codebase";

  const phaseSubtitle = isFailed
    ? "An error occurred during build."
    : isVisualVerifying
      ? "Measuring desktop (1440×900) and mobile (375×812) viewports for rendering integrity."
      : isRepairing
        ? `Applying targeted AI repair attempt ${project.repairAttempt || 1}...`
        : project.status === "validating"
          ? "Checking AST syntax, imports, exports, and component contracts."
          : "Streaming multi-file React components and design tokens.";

  return (
    <div className="relative h-full w-full bg-canvas flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
      {/* Subtle ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-white/[0.03] blur-[100px]"
      />

      {isVisualVerifying && reportVisualVerification && (
        <VisualVerificationRunner
          project={project}
          onReport={reportVisualVerification}
          onProgressUpdate={handleProgressUpdate}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="relative z-10 max-w-xl w-full bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Phase Stepper */}
        {!isFailed && (
          <div className="mb-7 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-canvas/60 p-1.5">
            {PHASES.map((phase, idx) => {
              const isActive = idx === activePhaseIndex;
              const isDone = idx < activePhaseIndex;
              return (
                <div
                  key={phase.id}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    isActive
                      ? "text-ink"
                      : isDone
                        ? "text-ink-secondary"
                        : "text-ink-subtle"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="agent-phase-pill"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-surface-active border border-white/10"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2Icon size={12} className="text-emerald-400" />
                    ) : isActive ? (
                      <span className="size-1.5 rounded-full bg-ink animate-pulse" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-ink-subtle" />
                    )}
                    <span>{phase.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Crossfading Phase Title & Subtitle */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseTitle}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 flex items-start gap-3.5"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface-elevated text-ink">
              {isFailed ? (
                <CircleIcon size={16} className="text-red-400" />
              ) : isVisualVerifying ? (
                <ShieldCheckIcon size={16} />
              ) : (
                <CpuIcon size={16} className="animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="font-display text-base font-medium text-ink">
                {phaseTitle}
              </h2>
              <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                {phaseSubtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Visual Verification Progress Card */}
        <AnimatePresence>
          {isVisualVerifying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-canvas/80 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon size={14} className="text-ink-secondary" />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink">
                      Visual Verification Loop
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-ink-secondary border border-white/10">
                    Round {verificationProgress.round} / 2
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink">Desktop</span>
                      <span className="font-mono text-[10px] text-ink-muted">1440 × 900</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      {verificationProgress.desktop === "passed" ? (
                        <>
                          <CheckCircle2Icon size={13} className="text-emerald-400 shrink-0" />
                          <span className="text-emerald-400 text-[11px]">Passed (0px overflow)</span>
                        </>
                      ) : (
                        <>
                          <Loader2Icon size={13} className="animate-spin text-ink-secondary shrink-0" />
                          <span className="text-ink-muted text-[11px]">Measuring...</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink">Mobile</span>
                      <span className="font-mono text-[10px] text-ink-muted">375 × 812</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      {verificationProgress.mobile === "passed" ? (
                        <>
                          <CheckCircle2Icon size={13} className="text-emerald-400 shrink-0" />
                          <span className="text-emerald-400 text-[11px]">Passed (0px overflow)</span>
                        </>
                      ) : (
                        <>
                          <Loader2Icon size={13} className="animate-spin text-ink-secondary shrink-0" />
                          <span className="text-ink-muted text-[11px]">Measuring...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isFailed && project.error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-medium">
            Error: {project.error}
          </div>
        )}

        {/* Animated Progress Bar */}
        {planned.length > 0 && !isFailed && (
          <div className="mb-6">
            <div className="flex justify-between font-mono text-[11px] text-ink-muted mb-2">
              <span>PROGRESS</span>
              <span className="text-ink">{progressPercent}%</span>
            </div>
            <div className="w-full h-1 bg-surface-active rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-ink rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )}

        {/* Files Checklist */}
        {planned.length > 0 ? (
          <div>
            <span className="block font-mono text-[10px] text-ink-muted uppercase tracking-widest mb-3">
              Planned Files ({completed.length}/{planned.length})
            </span>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 hide-scrollbar">
              {planned.map((file) => {
                const isCompleted = completed.includes(file.path);
                const isGenerating = !isFailed && current === file.path;

                return (
                  <motion.div
                    layout
                    key={file.path}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                      isGenerating
                        ? "bg-surface-elevated border-white/25"
                        : isCompleted
                          ? "bg-surface/60 border-white/10"
                          : "bg-surface/30 border-white/5 opacity-50"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2Icon size={15} className="text-emerald-400 shrink-0" />
                    ) : isGenerating ? (
                      <Loader2Icon size={15} className="animate-spin text-ink shrink-0" />
                    ) : (
                      <CircleIcon size={15} className="text-ink-subtle shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-mono text-xs truncate ${
                          isGenerating ? "text-ink font-medium" : "text-ink-secondary"
                        }`}
                      >
                        {file.path}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate mt-0.5">
                        {file.description}
                      </p>
                    </div>
                    {isGenerating && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-surface-active text-ink border border-white/10 animate-pulse uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          !isFailed && (
            <div className="flex flex-col items-center justify-center py-8 text-ink-muted">
              <Loader2Icon size={20} className="animate-spin mb-2.5 text-ink-secondary" />
              <p className="text-xs">Analyzing requirements and designing project structure...</p>
            </div>
          )
        )}
      </motion.div>
    </div>
  );
}
