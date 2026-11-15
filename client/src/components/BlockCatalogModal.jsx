import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BlocksIcon,
  CheckIcon,
  CopyIcon,
  FileCodeIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CATEGORIES, COMPONENT_BLOCKS } from '../data/componentBlocks';
import { useAppContext } from '../context/useAppContext';
import { resolveProjectFramework } from '../utils/frameworkUtils';

function injectImport(source, componentName, importLine) {
  const importRegex = new RegExp(`\\bimport\\s+.*\\b${componentName}\\b.*from`);
  if (importRegex.test(source)) {
    return source;
  }

  const matches = [
    ...source.matchAll(/(?:^|\n)[ \t]*import\b[\s\S]*?(?:from\s*)?['"][^'"]+['"];?/g),
  ];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertIndex = lastMatch.index + lastMatch[0].length;
    return (
      source.slice(0, insertIndex) + `\n${importLine}` + source.slice(insertIndex)
    );
  }

  return `${importLine}\n\n${source}`;
}

function injectJSX(source, componentName) {
  const mountedRegex = new RegExp(`<\\s*${componentName}\\b`);
  if (mountedRegex.test(source)) {
    return source;
  }

  const returnIndices = [];
  const re = /\breturn\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    returnIndices.push(match.index);
  }

  let container = null;
  for (let i = returnIndices.length - 1; i >= 0; i--) {
    const idx = returnIndices[i];
    const after = source.slice(idx + 6).trimStart();
    if (after.startsWith('(')) {
      let depth = 0;
      const startParen = source.indexOf('(', idx);
      let endParen = -1;
      for (let j = startParen; j < source.length; j++) {
        if (source[j] === '(') depth++;
        else if (source[j] === ')') {
          depth--;
          if (depth === 0) {
            endParen = j;
            break;
          }
        }
      }
      if (endParen !== -1) {
        const body = source.slice(startParen + 1, endParen);
        if (body.includes('<') && body.includes('>')) {
          container = {
            bodyStartIndex: startParen + 1,
            bodyEndIndex: endParen,
            body,
          };
          break;
        }
      }
    } else if (after.startsWith('<')) {
      const semiIndex = source.indexOf(';', idx);
      const endIndex = semiIndex !== -1 ? semiIndex : source.length;
      const body = source.slice(idx + 6, endIndex);
      if (body.includes('<') && body.includes('>')) {
        container = {
          bodyStartIndex: idx + 6,
          bodyEndIndex: endIndex,
          body,
        };
        break;
      }
    }
  }

  if (!container) {
    const arrowMatch = source.match(
      /=>\s*\(\s*([\s\S]*<\/(?:[a-zA-Z0-9_$.-]+)?>[\s\S]*?)\s*\)/,
    );
    if (arrowMatch) {
      const startParen = source.indexOf('(', source.indexOf('=>'));
      let depth = 0;
      let endParen = -1;
      for (let j = startParen; j < source.length; j++) {
        if (source[j] === '(') depth++;
        else if (source[j] === ')') {
          depth--;
          if (depth === 0) {
            endParen = j;
            break;
          }
        }
      }
      if (endParen !== -1) {
        container = {
          bodyStartIndex: startParen + 1,
          bodyEndIndex: endParen,
          body: source.slice(startParen + 1, endParen),
        };
      }
    }
  }

  if (!container) return null;

  const { body } = container;

  // 1. Check for footer (<footer or <Footer)
  const footerMatch = body.match(/(<footer\b|<Footer\b)/);
  if (footerMatch) {
    const footerIndex = footerMatch.index;
    const lineStartIndex = body.lastIndexOf('\n', footerIndex);
    const indent =
      lineStartIndex !== -1
        ? body.slice(lineStartIndex + 1, footerIndex).match(/^[ \t]*/)[0]
        : '      ';
    const insertion = `${indent}<${componentName} />\n`;
    const newBody =
      lineStartIndex !== -1
        ? body.slice(0, lineStartIndex + 1) +
          insertion +
          body.slice(lineStartIndex + 1)
        : insertion + body;
    return (
      source.slice(0, container.bodyStartIndex) +
      newBody +
      source.slice(container.bodyEndIndex)
    );
  }

  // 2. Outermost closing tag
  const lastClosingTagIndex = body.lastIndexOf('</');
  if (lastClosingTagIndex === -1) return null;
  const tagClosingMatch = body
    .slice(lastClosingTagIndex)
    .match(/^<\/(?:[a-zA-Z0-9_$.-]+)?>/);
  if (!tagClosingMatch) return null;

  const lineStartIndex = body.lastIndexOf('\n', lastClosingTagIndex);
  let newBody = '';
  if (lineStartIndex !== -1) {
    const wrapperIndent = body
      .slice(lineStartIndex + 1, lastClosingTagIndex)
      .match(/^[ \t]*/)[0];
    const indent = wrapperIndent + '  ';
    const insertion = `${indent}<${componentName} />\n`;
    newBody =
      body.slice(0, lineStartIndex + 1) +
      insertion +
      body.slice(lineStartIndex + 1);
  } else {
    const insertion = `  <${componentName} />\n`;
    newBody =
      body.slice(0, lastClosingTagIndex) +
      insertion +
      body.slice(lastClosingTagIndex);
  }

  return (
    source.slice(0, container.bodyStartIndex) +
    newBody +
    source.slice(container.bodyEndIndex)
  );
}

export default function BlockCatalogModal({ isOpen, onClose }) {
  const {
    activeProject,
    createFile,
    updateProjectFiles,
    setActiveFile,
    setShowCode,
    openFile,
  } = useAppContext();

  const framework = activeProject?.framework || resolveProjectFramework(activeProject);
  const isVanilla = framework === 'vanilla';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBlockId, setSelectedBlockId] = useState(COMPONENT_BLOCKS[0]?.id);
  const [codeView, setCodeView] = useState(isVanilla ? 'html' : 'react');
  const [copied, setCopied] = useState(false);
  const [inserting, setInserting] = useState(false);
  const modalRef = useRef(null);

  // Sync default codeView when framework changes
  useEffect(() => {
    setCodeView(isVanilla ? 'html' : 'react');
  }, [isVanilla]);

  // Initial focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const searchInput = modalRef.current?.querySelector('input');
        searchInput?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Modal Focus Trapping & Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = Array.from(
          modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modal.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modal.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter blocks
  const filteredBlocks = useMemo(() => {
    return COMPONENT_BLOCKS.filter((block) => {
      const matchesCategory =
        selectedCategory === 'All' || block.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        block.name.toLowerCase().includes(q) ||
        block.category.toLowerCase().includes(q) ||
        block.description.toLowerCase().includes(q) ||
        block.componentName.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  // Selected block object
  const selectedBlock = useMemo(() => {
    return (
      filteredBlocks.find((b) => b.id === selectedBlockId) ||
      filteredBlocks[0] ||
      COMPONENT_BLOCKS[0]
    );
  }, [filteredBlocks, selectedBlockId]);

  // Copy code to clipboard
  const handleCopyCode = async () => {
    if (!selectedBlock) return;
    const codeToCopy =
      codeView === 'html' ? selectedBlock.htmlCode : selectedBlock.reactCode;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      toast.success(
        `Copied ${selectedBlock.name} (${codeView === 'html' ? 'HTML' : 'React JSX'}) to clipboard!`,
      );
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Insert block into project
  const handleInsert = async () => {
    if (!activeProject) {
      toast.error('No active project found');
      return;
    }
    if (!selectedBlock) return;

    setInserting(true);

    try {
      if (isVanilla) {
        // --- VANILLA / STATIC HTML INSERTION ---
        const currentFiles = activeProject.files || {};
        const htmlKey = Object.keys(currentFiles).find(
          (k) =>
            k === '/index.html' ||
            k === 'index.html' ||
            k.endsWith('/index.html'),
        );

        if (htmlKey) {
          const fileEntry = currentFiles[htmlKey];
          const originalContent =
            typeof fileEntry === 'string'
              ? fileEntry
              : fileEntry?.content || '';

          const snippet = `\n  <!-- Block: ${selectedBlock.name} -->\n  ${selectedBlock.htmlCode.trim()}\n`;
          let updatedContent = '';

          if (originalContent.includes('</body>')) {
            updatedContent = originalContent.replace(
              '</body>',
              `${snippet}\n</body>`,
            );
          } else {
            updatedContent = `${originalContent}\n${snippet}`;
          }

          const updatedFiles = {
            ...currentFiles,
            [htmlKey]:
              typeof fileEntry === 'object' && fileEntry !== null
                ? { ...fileEntry, content: updatedContent }
                : { content: updatedContent },
          };

          await updateProjectFiles(updatedFiles);
          if (setActiveFile) setActiveFile(htmlKey);
          if (setShowCode) setShowCode(true);

          try {
            await navigator.clipboard.writeText(selectedBlock.htmlCode);
          } catch {
            // ignore clipboard failure
          }

          toast.success(
            `Inserted ${selectedBlock.name} into ${htmlKey}! (HTML also copied to clipboard)`,
            { duration: 4500 },
          );
          onClose();
        } else {
          // No index.html found; copy HTML snippet and inform user
          try {
            await navigator.clipboard.writeText(selectedBlock.htmlCode);
            toast.success(
              `No index.html found. Copied ${selectedBlock.name} HTML to clipboard!`,
              { duration: 4500 },
            );
          } catch {
            toast.error('Failed to copy HTML code to clipboard');
          }
          onClose();
        }
      } else {
        // --- REACT PROJECT INSERTION ---
        const currentFiles = activeProject.files || {};
        const fileKeys = Object.keys(currentFiles);

        // 1. Directory Convention Detection: inspect if existing files use /src/ prefix
        const hasSrcPrefix = fileKeys.some(
          (k) => k.startsWith('/src/') || k.startsWith('src/'),
        );
        const baseDir = hasSrcPrefix ? '/src/components' : '/components';

        let componentName = selectedBlock.componentName;
        let targetPath = `${baseDir}/${componentName}.jsx`;
        let counter = 2;

        // Resolve collision: /components/HeroSection.jsx -> /components/HeroSection2.jsx
        while (currentFiles[targetPath] || currentFiles[targetPath.replace(/^\//, '')]) {
          targetPath = `${baseDir}/${selectedBlock.componentName}${counter}.jsx`;
          componentName = `${selectedBlock.componentName}${counter}`;
          counter++;
        }

        let finalCode = selectedBlock.reactCode;
        if (componentName !== selectedBlock.componentName) {
          finalCode = finalCode.replace(
            new RegExp(
              `export\\s+default\\s+function\\s+${selectedBlock.componentName}\\b`,
            ),
            `export default function ${componentName}`,
          );
        }

        // 2. Auto-Mount into Root App File
        const candidateAppPaths = hasSrcPrefix
          ? [
              '/src/App.jsx',
              '/src/App.js',
              'src/App.jsx',
              'src/App.js',
              '/App.jsx',
              '/App.js',
              'App.jsx',
              'App.js',
            ]
          : [
              '/App.jsx',
              '/App.js',
              'App.jsx',
              'App.js',
              '/src/App.jsx',
              '/src/App.js',
              'src/App.jsx',
              'src/App.js',
            ];

        const appKey =
          candidateAppPaths.find((k) => currentFiles[k] !== undefined) ||
          fileKeys.find(
            (k) =>
              k === '/App.jsx' ||
              k === '/App.js' ||
              k.endsWith('/App.jsx') ||
              k.endsWith('/App.js'),
          );

        let relativeImportPath = `./components/${componentName}`;
        if (appKey) {
          const appInSrc = appKey.startsWith('/src/') || appKey.startsWith('src/');
          const compInSrc = targetPath.startsWith('/src/') || targetPath.startsWith('src/');
          if (appInSrc && !compInSrc) {
            relativeImportPath = `../components/${componentName}`;
          } else if (!appInSrc && compInSrc) {
            relativeImportPath = `./src/components/${componentName}`;
          } else {
            relativeImportPath = `./components/${componentName}`;
          }
        }

        const importSnippet = `import ${componentName} from '${relativeImportPath}';`;

        let mountedSuccessfully = false;

        if (appKey) {
          const appEntry = currentFiles[appKey];
          const appSource =
            typeof appEntry === 'string' ? appEntry : appEntry?.content || '';

          const sourceWithImport = injectImport(
            appSource,
            componentName,
            importSnippet,
          );
          const transformedAppSource = injectJSX(
            sourceWithImport,
            componentName,
          );

          if (transformedAppSource) {
            const updatedFiles = {
              ...currentFiles,
              [targetPath]: { content: finalCode },
              [appKey]:
                typeof appEntry === 'object' && appEntry !== null
                  ? { ...appEntry, content: transformedAppSource }
                  : { content: transformedAppSource },
            };

            await updateProjectFiles(updatedFiles);
            if (openFile) {
              openFile(targetPath);
            } else if (setActiveFile) {
              setActiveFile(targetPath);
            }
            if (setShowCode) setShowCode(true);

            toast.success(`Inserted & mounted <${componentName} /> in App`);
            mountedSuccessfully = true;
            onClose();
          }
        }

        if (!mountedSuccessfully) {
          // Fall back gracefully to creating component file and copying import snippet
          await createFile(targetPath, finalCode);

          try {
            await navigator.clipboard.writeText(importSnippet);
            toast.success(
              `Created ${targetPath}! Import snippet copied to clipboard: ${importSnippet}`,
              { duration: 5000 },
            );
          } catch {
            toast.success(
              `Created ${targetPath}! Usage: ${importSnippet} -> <${componentName} />`,
              { duration: 5000 },
            );
          }

          onClose();
        }
      }
    } catch (err) {
      console.error('Failed to insert component block:', err);
      toast.error('Failed to insert component block into project');
    } finally {
      setInserting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="block-catalog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            ref={modalRef}
            key="block-catalog-dialog"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="w-full max-w-5xl h-[88vh] max-h-[760px] glass-overlay rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-catalog-title"
          >
            {/* Header: Title, Search, Category Pills, Close */}
            <div className="shrink-0 border-b border-white/10 bg-canvas/90 px-4 sm:px-6 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-surface-elevated border border-white/10 flex items-center justify-center text-ink shrink-0">
                    <BlocksIcon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        id="block-catalog-title"
                        className="font-display text-sm sm:text-base font-medium text-ink"
                      >
                        Component Blocks
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-white/10 text-ink-muted">
                        {COMPONENT_BLOCKS.length} blocks
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted hidden sm:block">
                      Pre-designed, responsive UI sections ready to insert into your {isVanilla ? 'Static HTML' : 'React'} project.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="size-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-elevated transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <XIcon size={15} />
                </button>
              </div>

              {/* Search Bar & Categories Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <SearchIcon
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search blocks by name, category, or description..."
                    className="w-full bg-surface border border-white/10 focus:border-white/30 rounded-xl pl-9 pr-8 py-1.5 text-xs text-ink placeholder-ink-muted font-sans outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    >
                      <XIcon size={12} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                          isSelected
                            ? 'bg-ink text-canvas font-semibold'
                            : 'bg-surface text-ink-muted hover:text-ink hover:bg-surface-elevated border border-white/5'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Two-Pane Body */}
            <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-white/10">
              {/* Left Pane: Block Cards List */}
              <div className="w-full md:w-[380px] shrink-0 bg-surface/60 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {filteredBlocks.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-ink-muted">
                    <BlocksIcon size={24} className="mb-2 opacity-40" />
                    <p className="text-xs font-medium">No blocks match your search</p>
                    <p className="text-[11px] text-ink-subtle mt-1">
                      Try adjusting the search query or category filter.
                    </p>
                  </div>
                ) : (
                  filteredBlocks.map((block) => {
                    const isSelected = selectedBlock?.id === block.id;
                    return (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-surface-active border-white/25 shadow-md'
                            : 'bg-surface border-white/5 hover:border-white/15 hover:bg-surface-elevated'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-medium text-ink truncate">
                            {block.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-white/10 text-ink-secondary shrink-0">
                            {block.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">
                          {block.description}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-ink-subtle">
                          <span className="flex items-center gap-1 text-ink-muted">
                            <FileCodeIcon size={11} />
                            {isVanilla ? 'index.html' : block.suggestedPath}
                          </span>
                          {isSelected && (
                            <span className="text-ink font-sans text-[10px] font-medium">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Pane: Code Preview & Actions */}
              <div className="hidden md:flex flex-1 flex-col h-full bg-canvas/40 overflow-hidden">
                {selectedBlock ? (
                  <>
                    {/* Top Action Bar of Right Pane */}
                    <div className="shrink-0 px-5 py-3.5 border-b border-white/10 bg-surface/30 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-medium text-ink truncate">
                            {selectedBlock.name}
                          </h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-white/10 text-ink-muted">
                            {selectedBlock.componentName}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted truncate mt-0.5">
                          {isVanilla
                            ? 'Appends HTML block into index.html before </body>'
                            : `Creates ${selectedBlock.suggestedPath}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Format Switcher: React / HTML */}
                        <div className="flex items-center p-0.5 rounded-lg bg-surface border border-white/10 text-ink-muted">
                          <button
                            type="button"
                            onClick={() => setCodeView('react')}
                            className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition cursor-pointer ${
                              codeView === 'react'
                                ? 'bg-surface-active text-ink border border-white/10'
                                : 'hover:text-ink-secondary'
                            }`}
                          >
                            React JSX
                          </button>
                          <button
                            type="button"
                            onClick={() => setCodeView('html')}
                            className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition cursor-pointer ${
                              codeView === 'html'
                                ? 'bg-surface-active text-ink border border-white/10'
                                : 'hover:text-ink-secondary'
                            }`}
                          >
                            HTML5
                          </button>
                        </div>

                        {/* Copy Code Button */}
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-surface hover:bg-surface-elevated text-ink-secondary hover:text-ink text-xs font-medium transition cursor-pointer"
                          title="Copy block code to clipboard"
                        >
                          {copied ? (
                            <CheckIcon size={13} className="text-emerald-400" />
                          ) : (
                            <CopyIcon size={13} />
                          )}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Primary Insert Button */}
                        <button
                          type="button"
                          onClick={handleInsert}
                          disabled={inserting}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-ink hover:bg-white/90 text-canvas text-xs font-medium transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm"
                        >
                          <PlusIcon size={14} />
                          <span>
                            {inserting ? 'Inserting...' : 'Insert into Project'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Code Container */}
                    <div className="flex-1 overflow-auto p-4 bg-canvas/70 font-mono text-xs text-zinc-300 leading-relaxed selection:bg-white selection:text-black">
                      <pre className="hide-scrollbar">
                        <code>
                          {codeView === 'html'
                            ? selectedBlock.htmlCode
                            : selectedBlock.reactCode}
                        </code>
                      </pre>
                    </div>

                    {/* Footer helper note */}
                    <div className="shrink-0 px-5 py-2.5 border-t border-white/10 bg-surface/40 flex items-center justify-between text-[11px] text-ink-muted">
                      <div className="flex items-center gap-1.5">
                        <SparklesIcon size={12} className="text-ink-secondary" />
                        <span>
                          {isVanilla
                            ? 'Inserts semantic HTML with Tailwind CDN classes directly before </body> in index.html.'
                            : 'Generates clean modular component file and copies import statement to clipboard.'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-ink-subtle">
                        {codeView === 'html' ? 'HTML5' : 'React 18 + Tailwind'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-ink-muted text-xs">
                    <p>Select a block from the catalog to preview its source code.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Footer Action Bar (visible when right pane is hidden on small screens) */}
            <div className="md:hidden shrink-0 border-t border-white/10 bg-canvas px-4 py-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 py-2 rounded-lg border border-white/10 bg-surface text-ink text-xs font-medium text-center"
              >
                {copied ? 'Copied Code' : 'Copy Code'}
              </button>
              <button
                type="button"
                onClick={handleInsert}
                disabled={inserting}
                className="flex-1 py-2 rounded-lg bg-ink text-canvas text-xs font-medium text-center"
              >
                {inserting ? 'Inserting...' : 'Insert Block'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
