import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

const ARCHETYPE_SUGGESTIONS = {
  ecommerce: [
    { text: 'Add slide-out shopping cart', keywords: ['cart'] },
    { text: 'Add category & price filters', keywords: ['filter', 'category'] },
    { text: 'Add product quick-view modal', keywords: ['quickview', 'quick-view', 'productmodal'] },
    { text: 'Add trust badges & reviews', keywords: ['trust', 'badge', 'review'] },
  ],
  portfolio: [
    { text: 'Add interactive project case study modal', keywords: ['casestudy', 'case-study', 'projectmodal'] },
    { text: 'Add downloadable resume CTA', keywords: ['resume', 'cv'] },
    { text: 'Add client logo marquee', keywords: ['marquee', 'clientlogo', 'logo-marquee'] },
    { text: 'Add contact form validation', keywords: ['contactform', 'contact-form'] },
  ],
  saas: [
    { text: 'Add monthly/annual pricing toggle', keywords: ['pricing', 'pricingtoggle', 'price'] },
    { text: 'Add interactive FAQ accordion', keywords: ['faq', 'accordion'] },
    { text: 'Add customer testimonials grid', keywords: ['testimonial', 'testimonials'] },
    { text: 'Add feature comparison table', keywords: ['comparison', 'featuretable', 'feature-table'] },
  ],
  dashboard: [
    { text: 'Add search & status filtering', keywords: ['search', 'filter'] },
    { text: 'Add summary KPI metric cards', keywords: ['kpi', 'metric', 'statscard', 'kpicard'] },
    { text: 'Add responsive mobile navigation', keywords: ['mobilenav', 'mobile-nav'] },
    { text: 'Add empty & loading states', keywords: ['emptystate', 'empty-state'] },
  ],
  fallback: [
    { text: 'Enhance mobile responsiveness', keywords: ['responsive'] },
    { text: 'Add smooth scroll animations', keywords: ['animation'] },
    { text: 'Add interactive FAQ section', keywords: ['faq', 'accordion'] },
    { text: 'Polish footer & navigation', keywords: ['navigation'] },
  ],
};

const INITIAL_BUILD_STATUSES = [
  'pending',
  'generating',
  'validating',
  'repairing',
  'visual_verifying',
];

const ChatPanel = ({
  messages = [],
  onSend,
  loading = false,
  status = '',
  project = null,
  onFileSelect,
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const currentStatus = status || project?.status || '';
  const isInitialBuild = INITIAL_BUILD_STATUSES.includes(currentStatus);
  const showLoadingIndicator =
    (currentStatus === 'revising' || loading) && !isInitialBuild;

  // Compute 4 contextual suggestion chips based on project archetype, prompt & file contents
  const revisionSuggestions = useMemo(() => {
    const archetype = (project?.designSpec?.archetype || '').toLowerCase();
    const promptText = (
      project?.prompt ||
      project?.description ||
      project?.name ||
      ''
    ).toLowerCase();
    const category = (project?.designSpec?.category || '').toLowerCase();
    const combinedContext = `${archetype} ${category} ${promptText}`;

    let primaryPool = ARCHETYPE_SUGGESTIONS.fallback;

    if (
      combinedContext.includes('ecommerce') ||
      combinedContext.includes('e-commerce') ||
      combinedContext.includes('store') ||
      combinedContext.includes('shop') ||
      combinedContext.includes('retail') ||
      combinedContext.includes('cart') ||
      combinedContext.includes('product') ||
      combinedContext.includes('luxury')
    ) {
      primaryPool = ARCHETYPE_SUGGESTIONS.ecommerce;
    } else if (
      combinedContext.includes('portfolio') ||
      combinedContext.includes('agency') ||
      combinedContext.includes('freelance') ||
      combinedContext.includes('resume') ||
      combinedContext.includes('cv') ||
      combinedContext.includes('showcase') ||
      combinedContext.includes('creative') ||
      combinedContext.includes('editorial') ||
      combinedContext.includes('photograph')
    ) {
      primaryPool = ARCHETYPE_SUGGESTIONS.portfolio;
    } else if (
      combinedContext.includes('dashboard') ||
      combinedContext.includes('app') ||
      combinedContext.includes('admin') ||
      combinedContext.includes('crm') ||
      combinedContext.includes('portal') ||
      combinedContext.includes('analytics') ||
      combinedContext.includes('metrics') ||
      combinedContext.includes('utility')
    ) {
      primaryPool = ARCHETYPE_SUGGESTIONS.dashboard;
    } else if (
      combinedContext.includes('saas') ||
      combinedContext.includes('landing') ||
      combinedContext.includes('startup') ||
      combinedContext.includes('b2b') ||
      combinedContext.includes('software') ||
      combinedContext.includes('platform') ||
      combinedContext.includes('clean_modern') ||
      combinedContext.includes('minimal-saas') ||
      combinedContext.includes('swiss')
    ) {
      primaryPool = ARCHETYPE_SUGGESTIONS.saas;
    }

    // Inspect existing file names / paths in project to filter already built components
    const fileKeys = Object.keys(project?.files || {}).map((f) => f.toLowerCase());

    const isExisting = (keywords) => {
      if (!keywords || keywords.length === 0) return false;
      return keywords.some((kw) =>
        fileKeys.some((f) => f.includes(kw.toLowerCase()))
      );
    };

    // Filter candidate pool
    const selected = [];
    for (const item of primaryPool) {
      if (!isExisting(item.keywords)) {
        selected.push(item.text);
      }
    }

    // Backfill from fallback pool to ensure 4 suggestion chips
    if (selected.length < 4) {
      for (const item of ARCHETYPE_SUGGESTIONS.fallback) {
        if (!selected.includes(item.text) && !isExisting(item.keywords)) {
          selected.push(item.text);
        }
        if (selected.length >= 4) break;
      }
    }

    // Fallback if still under 4 items
    if (selected.length < 4) {
      for (const item of primaryPool) {
        if (!selected.includes(item.text)) {
          selected.push(item.text);
        }
        if (selected.length >= 4) break;
      }
    }

    return selected.slice(0, 4);
  }, [
    project?.designSpec?.archetype,
    project?.designSpec?.category,
    project?.prompt,
    project?.description,
    project?.name,
    project?.files,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showLoadingIndicator]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || showLoadingIndicator) return;
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
    <div className="flex flex-col h-full bg-surface text-ink border-r border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-canvas/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-surface-elevated border border-white/10 text-ink-secondary flex items-center justify-center">
            <SparklesIcon size={12} />
          </div>
          <span className="font-display text-xs font-medium tracking-tight text-ink">
            AI Architect
          </span>
        </div>
        <span className="text-[11px] font-mono text-ink-muted">
          {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="size-10 rounded-xl bg-surface-elevated border border-white/10 text-ink-secondary flex items-center justify-center">
              <BotIcon size={18} />
            </div>
            <h4 className="font-display text-sm font-medium text-ink">
              AI Command Interface
            </h4>
            <p className="text-xs text-ink-muted max-w-xs leading-relaxed">
              Ask for changes to layout, copy, colors, or components. Builder AI edits your React codebase in real time.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Role Header */}
                <div className="flex items-center gap-1.5 px-1 text-[11px] text-ink-muted">
                  {isUser ? (
                    <>
                      <span className="font-medium text-ink-secondary">You</span>
                      <UserIcon size={11} className="text-ink-muted" />
                    </>
                  ) : (
                    <>
                      <BotIcon size={11} className="text-ink-secondary" />
                      <span className="font-medium text-ink">Builder AI</span>
                    </>
                  )}
                  {msg.timestamp && (
                    <span className="font-mono text-[10px] text-ink-subtle flex items-center gap-0.5">
                      <ClockIcon size={9} />
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-surface-active text-ink rounded-br-sm border border-white/10'
                      : 'bg-surface-elevated/80 backdrop-blur-sm text-ink-secondary rounded-bl-sm border border-white/10'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-ink">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} onFileClick={onFileSelect} />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading Indicator */}
        {showLoadingIndicator && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1.5 items-start"
          >
            <div className="flex items-center gap-1.5 px-1 text-[11px] text-ink-muted">
              <BotIcon size={11} className="text-ink-secondary" />
              <span className="font-medium text-ink">Builder AI</span>
            </div>
            <div className="rounded-xl rounded-bl-sm px-3.5 py-2.5 bg-surface-elevated border border-white/10 flex items-center gap-2.5">
              <Loader2Icon size={13} className="animate-spin text-ink-secondary" />
              <span className="text-xs text-ink-secondary">Planning & applying revision...</span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Revision Suggestions */}
      {messages.length > 0 && !showLoadingIndicator && !isInitialBuild && (
        <div className="px-3 pt-2.5 pb-1.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto hide-scrollbar shrink-0 bg-canvas/40">
          {revisionSuggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSend(suggestion)}
              className="px-2.5 py-1 rounded-full bg-surface-elevated hover:bg-surface-hover border border-white/10 text-[11px] text-ink-secondary hover:text-ink shrink-0 transition-colors cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Command Input Box */}
      <div className="p-3 border-t border-white/10 shrink-0 bg-canvas/80 backdrop-blur-md">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-xl border border-white/10 bg-surface-elevated/90 focus-within:border-white/25 transition-colors overflow-hidden"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Command AI to refine layout, styles, or components..."
            rows={2}
            className="w-full p-3 pb-8 bg-transparent text-xs text-ink placeholder:text-ink-subtle outline-none resize-none leading-relaxed"
          />

          <div className="absolute bottom-2 left-3 right-2 flex items-center justify-between text-[11px] text-ink-muted pointer-events-none">
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px]">
              <CornerDownLeftIcon size={10} /> Enter to send
            </span>

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="pointer-events-auto flex size-6 items-center justify-center rounded-md bg-ink text-canvas hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Send revision request"
            >
              {loading ? (
                <Loader2Icon size={12} className="animate-spin" />
              ) : (
                <SendIcon size={12} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
