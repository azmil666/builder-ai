import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TerminalIcon,
  Trash2Icon,
} from 'lucide-react';

function serializeArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (
    typeof arg === 'number' ||
    typeof arg === 'boolean' ||
    typeof arg === 'bigint' ||
    typeof arg === 'symbol'
  ) {
    return String(arg);
  }
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === 'object') {
    if (arg.message && (arg.name || arg.stack)) {
      return `${arg.name || 'Error'}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
    }
    const seen = new WeakSet();
    try {
      return JSON.stringify(
        arg,
        (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch {
      try {
        return Object.prototype.toString.call(arg);
      } catch {
        return '[Unserializable Object]';
      }
    }
  }
  return String(arg);
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ConsoleDrawer({ projectId, framework }) {
  const { listen } = useSandpack();
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'log' | 'warn' | 'error'

  const scrollContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Clear logs automatically when active project ID or framework changes
  useEffect(() => {
    setLogs([]);
  }, [projectId, framework]);

  // Intercept Sandpack console and runtime error messages
  useEffect(() => {
    if (!listen) return;

    const unsubscribe = listen((msg) => {
      if (!msg) return;

      if (msg.type === 'console') {
        const rawLogs = Array.isArray(msg.log)
          ? msg.log
          : msg.log
            ? [msg.log]
            : msg.data !== undefined
              ? [{ method: msg.method || 'log', data: msg.data }]
              : [];

        const newItems = [];
        for (const rawLog of rawLogs) {
          if (!rawLog) continue;
          const rawMethod = String(rawLog.method || 'log').toLowerCase();
          if (rawMethod === 'clear') {
            setLogs([]);
            continue;
          }
          let method = 'log';
          if (rawMethod === 'error') {
            method = 'error';
          } else if (rawMethod === 'warn' || rawMethod === 'warning') {
            method = 'warn';
          } else if (rawMethod === 'info' || rawMethod === 'debug') {
            method = 'info';
          }

          const rawData = rawLog.data;
          const dataArray = Array.isArray(rawData) ? rawData : [rawData];
          const message = dataArray.map(serializeArg).join(' ');

          newItems.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            method,
            message,
            timestamp: getTimestamp(),
          });
        }

        if (newItems.length > 0) {
          setLogs((prev) => {
            const combined = [...prev, ...newItems];
            return combined.length > 200 ? combined.slice(combined.length - 200) : combined;
          });
        }
      } else if (
        (msg.type === 'action' && msg.action === 'show-error') ||
        msg.type === 'error'
      ) {
        let errorMsg = '';
        if (typeof msg.error === 'string') {
          errorMsg = msg.error;
        } else if (msg.error?.message) {
          errorMsg = msg.error.message;
        } else if (msg.message) {
          errorMsg = msg.title ? `${msg.title}: ${msg.message}` : msg.message;
        } else if (msg.title) {
          errorMsg = msg.title;
        } else {
          errorMsg = 'Uncaught runtime error';
        }

        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          method: 'error',
          message: errorMsg,
          timestamp: getTimestamp(),
        };

        setLogs((prev) => {
          const combined = [...prev, entry];
          return combined.length > 200 ? combined.slice(combined.length - 200) : combined;
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [listen]);

  // Counts
  const errorCount = useMemo(
    () => logs.filter((l) => l.method === 'error').length,
    [logs]
  );
  const warnCount = useMemo(
    () => logs.filter((l) => l.method === 'warn').length,
    [logs]
  );
  const logCount = useMemo(
    () => logs.filter((l) => l.method === 'log' || l.method === 'info').length,
    [logs]
  );
  const totalCount = logs.length;

  // Filtered log view
  const filteredLogs = useMemo(() => {
    if (filter === 'log') {
      return logs.filter((l) => l.method === 'log' || l.method === 'info');
    }
    if (filter === 'warn') {
      return logs.filter((l) => l.method === 'warn');
    }
    if (filter === 'error') {
      return logs.filter((l) => l.method === 'error');
    }
    return logs;
  }, [logs, filter]);

  // Handle auto-scroll logic
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 32;
    shouldAutoScrollRef.current = isNearBottom;
  };

  useEffect(() => {
    if (isExpanded && shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, isExpanded]);

  const handleClear = (e) => {
    e.stopPropagation();
    setLogs([]);
  };

  // Collapsed State: 32px-tall bottom status bar
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="h-8 shrink-0 border-t border-hairline bg-surface flex items-center justify-between px-3 text-xs select-none cursor-pointer hover:bg-surface-elevated/80 transition-colors"
        title="Click to expand Console"
      >
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon size={13} className="text-ink-secondary shrink-0" />
          <span className="font-mono text-xs font-medium text-ink">Console</span>

          {errorCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
              {errorCount} {errorCount === 1 ? 'error' : 'errors'}
            </span>
          )}

          {warnCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
            </span>
          )}

          <span className="text-[11px] font-mono text-ink-muted shrink-0">
            {totalCount} {totalCount === 1 ? 'log' : 'logs'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="p-1 rounded text-ink-secondary hover:text-ink transition cursor-pointer"
            title="Expand console"
            aria-label="Expand console"
          >
            <ChevronUpIcon size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Panel: 192px (h-48) with filter toolbar and log stream
  return (
    <div className="h-48 shrink-0 border-t border-hairline bg-surface-elevated flex flex-col z-20">
      {/* Toolbar */}
      <div className="h-8 shrink-0 border-b border-hairline bg-surface px-3 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <TerminalIcon size={13} className="text-ink-secondary" />
            <span className="font-mono text-xs font-medium text-ink">Console</span>
          </div>

          <div className="h-3 w-px bg-hairline shrink-0" />

          {/* Filter Pills */}
          <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-surface-active text-ink border border-hairline-strong'
                  : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-hover border border-transparent'
              }`}
            >
              All <span className="text-[10px] opacity-70">({totalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter('log')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filter === 'log'
                  ? 'bg-surface-active text-ink border border-hairline-strong'
                  : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-hover border border-transparent'
              }`}
            >
              Logs <span className="text-[10px] opacity-70">({logCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter('warn')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                filter === 'warn'
                  ? 'bg-surface-active text-amber-400 border border-amber-500/30'
                  : 'text-ink-muted hover:text-amber-400 hover:bg-surface-hover border border-transparent'
              }`}
            >
              Warnings
              {warnCount > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-400">
                  {warnCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilter('error')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                filter === 'error'
                  ? 'bg-surface-active text-red-400 border border-red-500/30'
                  : 'text-ink-muted hover:text-red-400 hover:bg-surface-hover border border-transparent'
              }`}
            >
              Errors
              {errorCount > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-red-500/20 text-red-400">
                  {errorCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-ink-muted hover:text-ink hover:bg-surface-hover transition cursor-pointer text-[11px] font-mono"
            title="Clear console"
            aria-label="Clear console"
          >
            <Trash2Icon size={12} />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded text-ink-secondary hover:text-ink hover:bg-surface-hover transition cursor-pointer"
            title="Collapse console"
            aria-label="Collapse console"
          >
            <ChevronDownIcon size={14} />
          </button>
        </div>
      </div>

      {/* Log Output Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto font-mono text-xs p-2 space-y-1 bg-surface select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full min-h-[110px] flex flex-col items-center justify-center text-ink-muted text-xs select-none">
            <TerminalIcon size={18} className="mb-2 opacity-30 text-ink-muted" />
            <span>{totalCount === 0 ? 'No console output yet' : 'No logs match filter'}</span>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`px-2.5 py-1 rounded text-xs flex items-start gap-2 leading-relaxed transition-colors ${
                log.method === 'error'
                  ? 'text-red-400 bg-red-500/5 border-l-2 border-red-500/50'
                  : log.method === 'warn'
                    ? 'text-amber-400 bg-amber-500/5 border-l-2 border-amber-500/50'
                    : 'text-ink-secondary hover:bg-surface-hover/50 border-l-2 border-transparent'
              }`}
            >
              <span className="text-ink-subtle select-none shrink-0 text-[11px] pt-0.5">
                [{log.timestamp}]
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
