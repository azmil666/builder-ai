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
        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl focus-within:border-zinc-700 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200 overflow-hidden"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={3}
          className="w-full p-4 sm:p-5 pb-2 resize-none placeholder:text-zinc-500 outline-none bg-transparent text-zinc-100 text-sm sm:text-base leading-relaxed"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 pb-4 pt-1 gap-3 border-t border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300">
              <CornerDownLeftIcon size={11} /> Enter
            </span>
            <span className="hidden sm:inline">to build</span>
            <span className="hidden sm:inline text-zinc-600">·</span>
            <span className="text-zinc-500 text-[11px]">Shift + Enter for newline</span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={!value.trim() || loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm transition-all duration-150 shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2Icon size={16} className="animate-spin text-zinc-900" />
                  <span>Planning & Building...</span>
                </>
              ) : (
                <>
                  <SparklesIcon size={16} className="text-zinc-900" />
                  <span>Build Website</span>
                  <ArrowRightIcon size={14} className="text-zinc-600 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
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
