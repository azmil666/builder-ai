import React from 'react';
import { PaletteIcon, SparklesIcon, TypeIcon } from 'lucide-react';

export default function DesignSpecPanel({ designSpec }) {
  if (!designSpec) {
    return (
      <div className="flex flex-col h-full bg-surface text-ink p-6 text-center items-center justify-center space-y-3">
        <div className="size-10 rounded-xl bg-surface-elevated border border-hairline text-ink-muted flex items-center justify-center">
          <PaletteIcon size={18} />
        </div>
        <h4 className="text-sm font-medium text-ink">No DesignSpec Generated</h4>
        <p className="text-xs text-ink-muted leading-relaxed max-w-xs">
          This project was created with legacy generation. Newly generated projects automatically generate a structured visual DesignSpec.
        </p>
      </div>
    );
  }

  const {
    websitePurpose,
    targetAudience,
    archetype,
    brandPersonality,
    colorPalette,
    typography,
    distinctiveVisualSignature,
  } = designSpec;

  return (
    <div className="flex flex-col h-full bg-surface text-ink border-r border-hairline overflow-y-auto p-4 space-y-5 hide-scrollbar">
      {/* Header */}
      <div className="border-b border-hairline pb-3">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon size={14} className="text-ink-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Design Intelligence
          </h3>
        </div>
        <p className="text-[11px] text-ink-muted">
          Visual tokens and architecture planned by AI
        </p>
      </div>

      {/* Archetype Badge */}
      <div className="p-3 rounded-xl bg-surface-elevated border border-hairline space-y-1.5">
        <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest block">
          Design Archetype
        </span>
        <div className="text-sm font-semibold text-ink capitalize">
          {archetype ? archetype.replace('-', ' ') : 'Minimal SaaS'}
        </div>
        {brandPersonality && (
          <p className="text-xs text-ink-secondary italic">&ldquo;{brandPersonality}&rdquo;</p>
        )}
      </div>

      {/* Color Tokens */}
      {colorPalette && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <PaletteIcon size={12} className="text-ink-secondary" />
            <span>Color Palette</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {colorPalette.primary && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-hairline">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.primary }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-ink-muted block">Primary</span>
                  <span className="font-mono text-[11px] text-ink truncate block">
                    {colorPalette.primary}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.accent && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-hairline">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.accent }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-ink-muted block">Accent</span>
                  <span className="font-mono text-[11px] text-ink truncate block">
                    {colorPalette.accent}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.background && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-hairline">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.background }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-ink-muted block">Background</span>
                  <span className="font-mono text-[11px] text-ink truncate block">
                    {colorPalette.background}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.text && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-hairline">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.text }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-ink-muted block">Text</span>
                  <span className="font-mono text-[11px] text-ink truncate block">
                    {colorPalette.text}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Typography */}
      {typography && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <TypeIcon size={12} className="text-ink-secondary" />
            <span>Typography Pairing</span>
          </div>

          <div className="p-3 rounded-xl bg-surface-elevated border border-hairline space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-ink-muted block">Headings Font</span>
              <span className="font-semibold text-ink">{typography.headingFont || 'Urbanist'}</span>
            </div>
            <div>
              <span className="text-[10px] text-ink-muted block">Body Font</span>
              <span className="font-semibold text-ink">{typography.bodyFont || 'Urbanist'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Purpose & Audience */}
      <div className="space-y-2 text-xs">
        {websitePurpose && (
          <div className="p-3 rounded-xl bg-surface-elevated border border-hairline">
            <span className="text-[10px] text-ink-muted uppercase tracking-widest block mb-1 font-mono">
              Mission / Purpose
            </span>
            <p className="text-ink-secondary leading-relaxed">{websitePurpose}</p>
          </div>
        )}

        {targetAudience && (
          <div className="p-3 rounded-xl bg-surface-elevated border border-hairline">
            <span className="text-[10px] text-ink-muted uppercase tracking-widest block mb-1 font-mono">
              Target Audience
            </span>
            <p className="text-ink-secondary leading-relaxed">{targetAudience}</p>
          </div>
        )}

        {distinctiveVisualSignature && (
          <div className="p-3 rounded-xl bg-surface-elevated border border-hairline">
            <span className="text-[10px] text-ink-muted uppercase tracking-widest block mb-1 font-mono">
              Visual Signature
            </span>
            <p className="text-ink-secondary leading-relaxed">{distinctiveVisualSignature}</p>
          </div>
        )}
      </div>
    </div>
  );
}
