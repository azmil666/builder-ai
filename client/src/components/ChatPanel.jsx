import React, { useEffect, useRef, useState } from 'react';
import {
  BotIcon,
  ClockIcon,
  CornerDownLeftIcon,
  Loader2Icon,
  SendIcon,
  SparklesIcon,
  UserIcon,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const REVISION_SUGGESTIONS = [
  'Add dark mode toggle',
  'Make hero responsive',
  'Add interactive pricing calculator',
  'Improve typography contrast',
];

const ChatPanel = ({ messages = [], onSend, loading = false, onFileSelect }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 border-r border-zinc-850">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <SparklesIcon size={12} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            AI Architect
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">
          {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="size-10 rounded-xl bg-zinc-900 border border-zinc-800 text-indigo-400 flex items-center justify-center">
              <BotIcon size={20} />
            </div>
            <h4 className="text-sm font-medium text-zinc-200">
              Interactive AI Revision
            </h4>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              Ask for changes to layout, copy, colors, or components. AI edits your React codebase in real-time.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Role Header */}
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-400">
                {isUser ? (
                  <>
                    <span className="font-medium text-zinc-300">You</span>
                    <UserIcon size={11} className="text-zinc-400" />
                  </>
                ) : (
                  <>
                    <BotIcon size={11} className="text-indigo-400" />
                    <span className="font-medium text-indigo-300">Builder AI</span>
                  </>
                )}
                {msg.timestamp && (
                  <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                    <ClockIcon size={9} />
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-zinc-800 text-zinc-100 rounded-br-sm border border-zinc-700/60'
                    : 'bg-zinc-900/90 text-zinc-200 rounded-bl-sm border border-zinc-800 shadow-sm'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <MarkdownRenderer content={msg.content} onFileClick={onFileSelect} />
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col gap-1.5 items-start animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-400">
              <BotIcon size={11} className="text-indigo-400" />
              <span className="font-medium text-indigo-300">Builder AI</span>
            </div>
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-zinc-900 border border-zinc-800 flex items-center gap-3">
              <Loader2Icon size={14} className="animate-spin text-indigo-400" />
              <span className="text-xs text-zinc-300">Planning & applying revision...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Revision Suggestions */}
      {messages.length > 0 && !loading && (
        <div className="px-3 pt-2 pb-1 border-t border-zinc-900 flex items-center gap-1.5 overflow-x-auto hide-scrollbar shrink-0">
          {REVISION_SUGGESTIONS.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSend(suggestion)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] text-zinc-400 hover:text-zinc-200 shrink-0 transition cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-zinc-850 shrink-0 bg-zinc-950">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-xl border border-zinc-800 bg-zinc-900/90 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all overflow-hidden"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask AI to modify design, add sections, fix styles..."
            rows={2}
            className="w-full p-3 pb-8 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 outline-none resize-none leading-relaxed"
          />

          <div className="absolute bottom-2 left-3 right-2 flex items-center justify-between text-[11px] text-zinc-400 pointer-events-none">
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px]">
              <CornerDownLeftIcon size={10} /> Enter to send
            </span>

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="pointer-events-auto p-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Send revision request"
            >
              {loading ? (
                <Loader2Icon size={12} className="animate-spin text-zinc-950" />
              ) : (
                <SendIcon size={12} className="text-zinc-950" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
