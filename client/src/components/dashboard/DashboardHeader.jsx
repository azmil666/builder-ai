import React from 'react';
import { LogOutIcon } from 'lucide-react';

const DashboardHeader = ({ user, onLogout }) => {
  const initial = user?.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-30 w-full bg-canvas/75 backdrop-blur-xl border-b border-hairline">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface-elevated">
            <img src="/logo.svg" alt="Builder AI" className="size-4 invert" />
          </div>
          <span className="font-display text-sm font-medium tracking-tight text-ink">
            Builder AI
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            Studio
          </span>
        </div>

        {/* User profile & quiet sign out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-hairline bg-surface/60 py-1 pl-1.5 pr-3">
            <div className="flex size-6 items-center justify-center rounded-full bg-surface-active font-mono text-[11px] font-medium text-ink">
              {initial}
            </div>
            <span className="hidden sm:inline text-xs font-medium text-ink-secondary max-w-[140px] truncate">
              {user?.name || 'Workspace'}
            </span>
          </div>

          <button
            onClick={onLogout}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink cursor-pointer"
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
