import { ArrowRightIcon, CornerDownLeftIcon, Loader2Icon, SparklesIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const Promptinput = ({
  onSubmit,
  loading = false,
  placeholder = "Describe the website you want to build...",
  large = false,
  autoFocus = false,
  variant = "default",
  value: controlledValue,
  onChange: onControlledChange,
}) => {
  const [internalValue, setInternalValue] = useState("");
  const textareaRef = useRef(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e) => {
    if (isControlled) {
      if (onControlledChange) onControlledChange(e.target.value);
    } else {
      setInternalValue(e.target.value);
    }
  };

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    if (!isControlled) {
      setInternalValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (variant === "glass" || variant === "dashboard") {
    return (
      <form
        onSubmit={handleSubmit}
        className="group relative w-full overflow-hidden rounded-2xl border border-hairline bg-surface/90 backdrop-blur-xl transition-all duration-200 focus-within:border-white/25 focus-within:bg-surface-elevated/90"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-2">
          <SparklesIcon
            size={16}
            className="mt-1 shrink-0 text-ink-muted transition-colors group-focus-within:text-ink"
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            rows={3}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-hairline px-5 py-3 bg-canvas/40">
          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">
              <CornerDownLeftIcon size={10} /> Enter
            </span>
            <span className="hidden sm:inline">to generate</span>
            <span className="hidden sm:inline text-ink-subtle">·</span>
            <span className="text-ink-subtle">Shift + Enter for newline</span>
          </div>

          <button
            type="submit"
            disabled={!value.trim() || loading}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-ink px-5 py-2 text-xs font-medium text-canvas transition-all duration-150 hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2Icon size={14} className="animate-spin" />
                <span>Building...</span>
              </>
            ) : (
              <>
                <span>Build Website</span>
                <ArrowRightIcon size={13} />
              </>
            )}
          </button>
        </div>
      </form>
    );
  }

  // Default variant (used in ChatPanel)
  return (
    <div
      className={`bg-white border border-zinc-200 rounded-xl flex items-end gap-2 focus-within:ring-1 focus-within:ring-zinc-300 transition ${
        large ? "p-4" : "p-3"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={loading}
        rows={large ? 5 : 1}
        className={`flex-1 bg-transparent border-none outline-none resize-none text-zinc-900 placeholder:text-zinc-400 ${
          large ? "text-base" : "text-sm"
        }`}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || loading}
        className="inline-flex items-center justify-center bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer rounded-full shrink-0"
        style={{
          width: large ? 36 : 24,
          height: large ? 36 : 24,
        }}
      >
        {loading ? (
          <Loader2Icon size={large ? 20 : 15} className="animate-spin" />
        ) : (
          <ArrowRightIcon size={large ? 20 : 15} />
        )}
      </button>
    </div>
  );
};

export default Promptinput;
