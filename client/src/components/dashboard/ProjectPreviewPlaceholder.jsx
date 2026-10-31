import React from 'react';
import { ExternalLinkIcon, GlobeIcon, SparklesIcon } from 'lucide-react';

const ARCHETYPE_CONFIG = {
  'minimal-saas': {
    label: 'Minimal SaaS',
    gradient: 'from-indigo-950/40 via-zinc-900 to-zinc-950',
    accent: '#6366f1',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  'editorial': {
    label: 'Editorial',
    gradient: 'from-amber-950/30 via-zinc-900 to-zinc-950',
    accent: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  'luxury': {
    label: 'Luxury',
    gradient: 'from-yellow-950/30 via-zinc-900 to-zinc-950',
    accent: '#eab308',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  'swiss-style': {
    label: 'Swiss Style',
    gradient: 'from-red-950/30 via-zinc-900 to-zinc-950',
    accent: '#ef4444',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  'neo-brutalist': {
    label: 'Neo-Brutalist',
    gradient: 'from-lime-950/30 via-zinc-900 to-zinc-950',
    accent: '#eab308',
    badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
  },
  'futuristic-tech': {
    label: 'Futuristic Tech',
    gradient: 'from-cyan-950/40 via-zinc-900 to-zinc-950',
    accent: '#06b6d4',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  'organic-natural': {
    label: 'Organic',
    gradient: 'from-emerald-950/30 via-zinc-900 to-zinc-950',
    accent: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  'modern-ecommerce': {
    label: 'E-Commerce',
    gradient: 'from-purple-950/30 via-zinc-900 to-zinc-950',
    accent: '#a855f7',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  'bold-expressive': {
    label: 'Expressive',
    gradient: 'from-fuchsia-950/30 via-zinc-900 to-zinc-950',
    accent: '#d946ef',
    badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  },
  'retro-vintage': {
    label: 'Retro',
    gradient: 'from-orange-950/30 via-zinc-900 to-zinc-950',
    accent: '#f97316',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  'playful-creative': {
    label: 'Playful',
    gradient: 'from-pink-950/30 via-zinc-900 to-zinc-950',
    accent: '#ec4899',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
  'monochrome-minimal': {
    label: 'Monochrome',
    gradient: 'from-zinc-900 via-zinc-950 to-black',
    accent: '#ffffff',
    badge: 'bg-white/10 text-zinc-300 border-white/20',
  },
};

const ProjectPreviewPlaceholder = ({ project }) => {
  const archetypeKey = project?.designSpec?.archetype || 'minimal-saas';
  const config = ARCHETYPE_CONFIG[archetypeKey] || ARCHETYPE_CONFIG['minimal-saas'];
  const domain = (project?.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'app';

  const isPublished = Boolean(project?.published);
  const primaryColor = project?.designSpec?.colorPalette?.primary;

  return (
    <div className="relative w-full aspect-[16/10] bg-zinc-950 rounded-t-xl overflow-hidden border-b border-zinc-850 flex flex-col select-none group-hover:border-zinc-700 transition-colors">
      {/* Mini Browser Bar */}
      <div className="h-7 bg-zinc-900/95 border-b border-zinc-800/80 px-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-red-500/70" />
          <div className="size-2 rounded-full bg-yellow-500/70" />
          <div className="size-2 rounded-full bg-green-500/70" />
        </div>

        <div className="flex-1 max-w-[170px] mx-auto h-4 rounded bg-zinc-950/70 border border-zinc-800/60 px-2 flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 truncate">
          <GlobeIcon size={9} className="text-zinc-500 shrink-0" />
          <span className="truncate">{domain}.builder.ai</span>
        </div>

        <div className="flex items-center gap-1">
          {isPublished ? (
            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          ) : (
            <span className="size-1.5 rounded-full bg-zinc-600" />
          )}
        </div>
      </div>

      {/* Mini Mockup Canvas */}
      <div className={`flex-1 p-3 bg-gradient-to-b ${config.gradient} flex flex-col justify-between relative overflow-hidden`}>
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
            backgroundSize: '12px 12px',
          }}
        />

        {/* Archetype Wireframe Layout */}
        <div className="relative z-10 w-full space-y-2">
          {/* Mock Nav */}
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div className="h-1.5 w-10 rounded bg-white/30" />
            <div className="flex items-center gap-1">
              <div className="h-1 w-6 rounded bg-white/15" />
              <div className="h-1 w-6 rounded bg-white/15" />
              <div
                className="h-2 w-8 rounded text-[6px] flex items-center justify-center font-mono text-white/90"
                style={{ backgroundColor: primaryColor || config.accent }}
              />
            </div>
          </div>

          {/* Hero mockup */}
          {archetypeKey === 'editorial' ? (
            <div className="space-y-1.5 pt-1">
              <div className="h-3 w-3/4 rounded bg-white/40" />
              <div className="h-2 w-1/2 rounded bg-white/20" />
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="h-8 rounded bg-white/5 border border-white/10" />
                <div className="h-8 rounded bg-white/5 border border-white/10" />
              </div>
            </div>
          ) : archetypeKey === 'swiss-style' ? (
            <div className="space-y-1.5 pt-1">
              <div className="h-4 w-4/5 rounded bg-white/50" />
              <div className="grid grid-cols-3 gap-1 pt-1">
                <div className="h-7 rounded bg-white/10 border border-white/10" />
                <div className="h-7 rounded bg-white/10 border border-white/10" />
                <div className="h-7 rounded bg-white/10 border border-white/10" />
              </div>
            </div>
          ) : archetypeKey === 'luxury' ? (
            <div className="flex flex-col items-center text-center space-y-1 pt-1">
              <div className="h-1 w-6 rounded bg-yellow-400/40" />
              <div className="h-2.5 w-2/3 rounded bg-white/40" />
              <div className="h-1.5 w-1/2 rounded bg-white/20" />
              <div className="h-6 w-full rounded bg-white/5 border border-yellow-500/10 mt-1" />
            </div>
          ) : (
            /* Default Minimal SaaS / Modern Tech */
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-14 rounded-full bg-white/20" />
              </div>
              <div className="h-2.5 w-4/5 rounded bg-white/40" />
              <div className="h-1.5 w-3/5 rounded bg-white/20" />
              <div className="grid grid-cols-3 gap-1 pt-1">
                <div className="h-6 rounded bg-white/5 border border-white/10 p-1 flex flex-col justify-between">
                  <div className="h-1 w-3 rounded bg-white/30" />
                  <div className="h-1 w-full rounded bg-white/10" />
                </div>
                <div className="h-6 rounded bg-white/5 border border-white/10 p-1 flex flex-col justify-between">
                  <div className="h-1 w-3 rounded bg-white/30" />
                  <div className="h-1 w-full rounded bg-white/10" />
                </div>
                <div className="h-6 rounded bg-white/5 border border-white/10 p-1 flex flex-col justify-between">
                  <div className="h-1 w-3 rounded bg-white/30" />
                  <div className="h-1 w-full rounded bg-white/10" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tag */}
        <div className="relative z-10 flex items-center justify-between pt-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${config.badge}`}>
            <SparklesIcon size={9} />
            {config.label}
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            v{project?.version || 1}
          </span>
        </div>

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 text-white font-medium text-xs z-20">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl flex items-center gap-1.5">
            <ExternalLinkIcon size={12} className="text-indigo-400" />
            Open Builder
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectPreviewPlaceholder;

