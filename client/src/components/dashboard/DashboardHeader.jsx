import React from 'react';
import { LogOutIcon, SparklesIcon } from 'lucide-react';

const DashboardHeader = ({ user, onLogout }) => {
  const initial = user?.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center size-9 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <img src="/logo.svg" alt="Builder AI" className="size-5" />
            <div className="absolute inset-0 rounded-xl bg-indigo-500/10 blur-sm pointer-events-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Builder<span className="text-indigo-400">AI</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <SparklesIcon size={10} className="text-indigo-400" /> Studio
            </span>
          </div>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 pl-2 py-1 pr-1 sm:pr-3 rounded-full bg-zinc-900/60 border border-zinc-800/80">
            <div className="size-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {initial}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-medium text-zinc-200 leading-tight">
                {user?.name || 'Workspace User'}
              </span>
              <span className="text-[10px] text-zinc-400 leading-tight truncate max-w-[140px]">
                {user?.email || ''}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 text-xs font-medium transition-all duration-150 cursor-pointer"
            title="Sign out of Builder AI"
          >
            <LogOutIcon size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;

