import React from 'react';
import { PaletteIcon, SparklesIcon, TypeIcon } from 'lucide-react';

export default function DesignSpecPanel({ designSpec }) {
  if (!designSpec) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 p-6 text-center items-center justify-center space-y-3">
        <div className="size-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center">
          <PaletteIcon size={18} />
        </div>
        <h4 className="text-sm font-medium text-zinc-200">No DesignSpec Generated</h4>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
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
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 border-r border-zinc-850 overflow-y-auto p-4 space-y-5 hide-scrollbar">
      {/* Header */}
      <div className="border-b border-zinc-850 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon size={14} className="text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Design Intelligence
          </h3>
        </div>
        <p className="text-[11px] text-zinc-400">
          Visual tokens and architecture planned by AI
        </p>
      </div>

      {/* Archetype Badge */}
      <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
          Design Archetype
        </span>
        <div className="text-sm font-semibold text-white capitalize">
          {archetype ? archetype.replace('-', ' ') : 'Minimal SaaS'}
        </div>
        {brandPersonality && (
          <p className="text-xs text-zinc-400 italic">"{brandPersonality}"</p>
        )}
      </div>

      {/* Color Tokens */}
      {colorPalette && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <PaletteIcon size={12} className="text-indigo-400" />
            <span>Color Palette</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {colorPalette.primary && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.primary }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 block">Primary</span>
                  <span className="font-mono text-[11px] text-zinc-200 truncate block">
                    {colorPalette.primary}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.accent && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.accent }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 block">Accent</span>
                  <span className="font-mono text-[11px] text-zinc-200 truncate block">
                    {colorPalette.accent}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.background && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.background }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 block">Background</span>
                  <span className="font-mono text-[11px] text-zinc-200 truncate block">
                    {colorPalette.background}
                  </span>
                </div>
              </div>
            )}

            {colorPalette.text && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <div
                  className="size-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: colorPalette.text }}
                />
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 block">Text</span>
                  <span className="font-mono text-[11px] text-zinc-200 truncate block">
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
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <TypeIcon size={12} className="text-indigo-400" />
            <span>Typography Pairing</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-zinc-400 block">Headings Font</span>
              <span className="font-semibold text-zinc-100">{typography.headingFont || 'Urbanist'}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Body Font</span>
              <span className="font-semibold text-zinc-100">{typography.bodyFont || 'Urbanist'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Purpose & Audience */}
      <div className="space-y-2 text-xs">
        {websitePurpose && (
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-1">
              Mission / Purpose
            </span>
            <p className="text-zinc-300 leading-relaxed">{websitePurpose}</p>
          </div>
        )}

        {targetAudience && (
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-1">
              Target Audience
            </span>
            <p className="text-zinc-300 leading-relaxed">{targetAudience}</p>
          </div>
        )}

        {distinctiveVisualSignature && (
          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest block mb-1">
              Visual Signature
            </span>
            <p className="text-indigo-200 leading-relaxed">{distinctiveVisualSignature}</p>
          </div>
        )}
      </div>
    </div>
  );
}

