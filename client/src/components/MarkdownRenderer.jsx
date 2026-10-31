import React, { useState } from 'react';
import { CheckIcon, CopyIcon, FileCodeIcon } from 'lucide-react';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800/80 text-zinc-400 font-mono text-[11px]">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 hover:text-zinc-200 transition cursor-pointer"
        >
          {copied ? <CheckIcon size={12} className="text-emerald-400" /> : <CopyIcon size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-zinc-200 font-mono text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text, onFileClick) {
  if (!text) return null;

  // Tokenize for inline code, bold, italic, and file paths
  const tokens = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining) {
    // Match inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      const codeText = codeMatch[1];
      const isFilePath = codeText.startsWith('/') && /\.(js|jsx|css|json|html)$/.test(codeText);

      tokens.push(
        isFilePath && onFileClick ? (
          <button
            key={keyIndex++}
            type="button"
            onClick={() => onFileClick(codeText)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[11px] hover:bg-indigo-500/20 cursor-pointer transition mx-0.5"
            title={`Open ${codeText}`}
          >
            <FileCodeIcon size={10} />
            <span>{codeText}</span>
          </button>
        ) : (
          <code
            key={keyIndex++}
            className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 font-mono text-[11px] text-indigo-300 mx-0.5"
          >
            {codeText}
          </code>
        ),
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Match bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      tokens.push(
        <strong key={keyIndex++} className="font-semibold text-zinc-100">
          {boldMatch[1]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Match italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      tokens.push(
        <em key={keyIndex++} className="italic text-zinc-300">
          {italicMatch[1]}
        </em>,
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Find nearest formatting marker
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial > 0) {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

export default function MarkdownRenderer({ content, onFileClick }) {
  if (!content) return null;

  // Split into lines to parse block structures
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block start or end
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            language={codeLanguage}
            code={codeBuffer.join('\n')}
          />,
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLanguage = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-xs font-semibold uppercase tracking-wider text-zinc-200 mt-3 mb-1">
          {renderInline(line.slice(4), onFileClick)}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-zinc-100 mt-3 mb-1.5">
          {renderInline(line.slice(3), onFileClick)}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-white mt-3.5 mb-2">
          {renderInline(line.slice(2), onFileClick)}
        </h2>,
      );
      continue;
    }

    // Bullet list items
    if (/^[-*]\s+/.test(line)) {
      const listContent = line.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 text-[13px] leading-relaxed text-zinc-300">
          <span className="size-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
          <div className="flex-1 min-w-0">{renderInline(listContent, onFileClick)}</div>
        </div>,
      );
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+)\.\s+(.*)/);
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 text-[13px] leading-relaxed text-zinc-300">
          <span className="font-mono text-xs text-indigo-400 font-semibold mt-0.5 shrink-0">
            {match[1]}.
          </span>
          <div className="flex-1 min-w-0">{renderInline(match[2], onFileClick)}</div>
        </div>,
      );
      continue;
    }

    // Empty lines create spacing
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Standard paragraph line
    elements.push(
      <p key={i} className="text-[13px] leading-relaxed text-zinc-300 my-0.5">
        {renderInline(line, onFileClick)}
      </p>,
    );
  }

  // Handle unclosed code block if any
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-unclosed"
        language={codeLanguage}
        code={codeBuffer.join('\n')}
      />,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

