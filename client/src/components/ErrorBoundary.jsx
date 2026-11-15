import React, { Component } from 'react';
import { AlertTriangleIcon, RefreshCwIcon, RotateCcwIcon } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  handleReset = () => {
    if (typeof this.props.onReset === 'function') {
      try {
        this.props.onReset();
      } catch (err) {
        console.error('[ErrorBoundary onReset error]:', err);
      }
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'An unexpected error occurred while rendering this component.',
        compact = false,
      } = this.props;

      const { error, errorInfo } = this.state;

      if (compact) {
        return (
          <div className="h-full w-full min-h-[240px] flex flex-col items-center justify-center p-6 bg-[#0a0a0a] text-white border border-white/10 rounded-xl text-center">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-zinc-300">
              <AlertTriangleIcon className="w-4 h-4 text-zinc-300" />
            </div>
            <h3 className="text-sm font-medium text-white tracking-tight">
              {fallbackTitle}
            </h3>
            {fallbackMessage && (
              <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                {fallbackMessage}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <RotateCcwIcon className="w-3 h-3" />
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors cursor-pointer"
              >
                <RefreshCwIcon className="w-3 h-3" />
                Reload
              </button>
            </div>

            {error && (
              <details className="mt-4 w-full max-w-md text-left bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-zinc-400">
                <summary className="font-mono text-[11px] text-zinc-400 hover:text-white cursor-pointer select-none">
                  View error details
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        );
      }

      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-zinc-300">
              <AlertTriangleIcon className="w-6 h-6 text-zinc-300" />
            </div>

            <h2 className="text-lg font-semibold text-white tracking-tight">
              {fallbackTitle}
            </h2>

            {fallbackMessage && (
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                {fallbackMessage}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <RotateCcwIcon className="w-3.5 h-3.5" />
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors cursor-pointer"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Reload
              </button>
            </div>

            {error && (
              <details className="mt-6 w-full text-left bg-black/60 border border-white/10 rounded-lg p-3 text-xs text-zinc-400">
                <summary className="font-mono text-xs text-zinc-400 hover:text-white cursor-pointer select-none">
                  View error details
                </summary>
                <pre className="mt-2 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
