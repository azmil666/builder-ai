import React from 'react'
import { motion } from 'framer-motion'
import { LayersIcon, SparklesIcon, TerminalIcon } from 'lucide-react'

const LoginLeft = () => {
  return (
    <div className="relative hidden lg:flex lg:w-[54%] flex-col justify-between overflow-hidden bg-surface p-12 xl:p-16 select-none border-r border-hairline">
      {/* Subtle architectural grid & radial light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black_40%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-[120px]"
      />

      {/* Top Brand */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex items-center gap-3"
      >
        <div className="flex size-9 items-center justify-center rounded-lg border border-hairline bg-surface-elevated">
          <img src="/logo.svg" alt="Builder AI" className="size-5 invert" />
        </div>
        <span className="font-display text-lg font-medium tracking-tight text-ink">
          Builder AI
        </span>
        <span className="ml-1 rounded-full border border-hairline bg-surface-elevated px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary">
          Studio
        </span>
      </motion.div>

      {/* Center Abstract 3D / Glassmorphic Composition */}
      <div className="relative z-10 my-auto flex items-center justify-center py-12">
        <div className="relative w-full max-w-md [perspective:1200px]">
          {/* Back Ambient Glass Plane */}
          <motion.div
            initial={{ opacity: 0, rotateX: 14, rotateY: -16, scale: 0.92 }}
            animate={{ opacity: 1, rotateX: 10, rotateY: -12, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="glass-overlay rounded-2xl p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)]"
          >
            {/* Window Chrome */}
            <div className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-white/20" />
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/10" />
              </div>
              <span className="font-mono text-[11px] text-ink-muted">
                app/page.tsx
              </span>
            </div>

            {/* Abstract Wireframe Blocks */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-elevated/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface">
                    <SparklesIcon size={15} className="text-ink" />
                  </div>
                  <div>
                    <div className="h-2 w-24 rounded-full bg-white/80" />
                    <div className="mt-1.5 h-1.5 w-36 rounded-full bg-white/20" />
                  </div>
                </div>
                <span className="font-mono text-[10px] text-ink-secondary">
                  READY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-hairline bg-surface-elevated/50 p-4">
                  <LayersIcon size={15} className="mb-3 text-ink-secondary" />
                  <div className="h-2 w-16 rounded-full bg-white/60" />
                  <div className="mt-2 h-1.5 w-24 rounded-full bg-white/15" />
                </div>
                <div className="rounded-xl border border-hairline bg-surface-elevated/50 p-4">
                  <TerminalIcon size={15} className="mb-3 text-ink-secondary" />
                  <div className="h-2 w-20 rounded-full bg-white/60" />
                  <div className="mt-2 h-1.5 w-20 rounded-full bg-white/15" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating Foreground Glass Pill */}
          <motion.div
            initial={{ opacity: 0, y: 18, x: 16 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="glass-overlay absolute -bottom-5 -right-4 flex items-center gap-3 rounded-xl px-4 py-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)]"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span className="font-mono text-xs text-ink">
              Live React + JSX Preview
            </span>
          </motion.div>
        </div>
      </div>

      {/* Bottom Editorial Copy */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-md"
      >
        <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
          Build your presence on the web.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Describe what you need, preview instantly, and refine your interface
          in real time with clean JSX, verified layouts, and instant code
          exports.
        </p>
        <p className="mt-8 font-mono text-[11px] text-ink-muted">
          © {new Date().getFullYear()} BuilderAI. All rights reserved.
        </p>
      </motion.div>
    </div>
  )
}

export default LoginLeft
