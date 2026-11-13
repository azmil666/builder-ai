import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CodeIcon,
  FileCodeIcon,
  FilePlusIcon,
  FileTextIcon,
  XIcon,
} from 'lucide-react';

const VANILLA_FILE_TEMPLATES = [
  {
    id: 'html',
    label: 'HTML Page',
    ext: '.html',
    icon: FileCodeIcon,
    defaultPath: '/about.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Page</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-white min-h-screen p-8">
  <main class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">New Page</h1>
    <p class="text-zinc-400">Content goes here.</p>
  </main>
  <script src="script.js"></script>
</body>
</html>
`,
  },
  {
    id: 'css',
    label: 'CSS Stylesheet',
    ext: '.css',
    icon: FileTextIcon,
    defaultPath: '/custom.css',
    content: `/* Custom Project Styles */
.custom-card {
  transition: all 0.2s ease-in-out;
}

.custom-card:hover {
  transform: translateY(-2px);
}
`,
  },
  {
    id: 'script',
    label: 'JavaScript File',
    ext: '.js',
    icon: CodeIcon,
    defaultPath: '/scripts/main.js',
    content: `// Client Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('Script loaded successfully');
});
`,
  },
  {
    id: 'json',
    label: 'JSON Data',
    ext: '.json',
    icon: FileTextIcon,
    defaultPath: '/data.json',
    content: `{
  "items": [
    {
      "id": 1,
      "title": "Item 1",
      "description": "Sample data"
    }
  ]
}
`,
  },
];

const REACT_FILE_TEMPLATES = [
  {
    id: 'component',
    label: 'React Component',
    ext: '.jsx',
    icon: FileCodeIcon,
    defaultPath: '/components/NewComponent.jsx',
    content: `import React from 'react';

export default function NewComponent() {
  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
      <h3 className="text-base font-semibold">New Component</h3>
      <p className="text-sm text-zinc-400 mt-1">Ready for custom styling & logic.</p>
    </div>
  );
}
`,
  },
  {
    id: 'css',
    label: 'CSS Stylesheet',
    ext: '.css',
    icon: FileTextIcon,
    defaultPath: '/custom.css',
    content: `/* Custom Project Styles */
.custom-card {
  transition: all 0.2s ease-in-out;
}

.custom-card:hover {
  transform: translateY(-2px);
}
`,
  },
  {
    id: 'json',
    label: 'JSON Data',
    ext: '.json',
    icon: FileTextIcon,
    defaultPath: '/data.json',
    content: `{
  "items": [
    {
      "id": 1,
      "title": "Item 1",
      "description": "Sample data"
    }
  ]
}
`,
  },
  {
    id: 'util',
    label: 'JavaScript Utility',
    ext: '.js',
    icon: CodeIcon,
    defaultPath: '/utils/helpers.js',
    content: `// Utility Functions
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
`,
  },
];

export default function FileCreateModal({
  isOpen,
  onClose,
  existingFiles = {},
  framework = 'react',
  onCreate,
}) {
  const isVanilla = framework === 'vanilla';
  const templates = isVanilla ? VANILLA_FILE_TEMPLATES : REACT_FILE_TEMPLATES;

  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [filePath, setFilePath] = useState(templates[0].defaultPath);
  const [error, setError] = useState('');

  // Update template selection when framework changes
  useEffect(() => {
    const nextTemplates = isVanilla ? VANILLA_FILE_TEMPLATES : REACT_FILE_TEMPLATES;
    setSelectedTemplate(nextTemplates[0]);
    setFilePath(nextTemplates[0].defaultPath);
    setError('');
  }, [isVanilla]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFilePath(template.defaultPath);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = filePath.trim();
    if (!trimmed) {
      setError('File path cannot be empty');
      return;
    }

    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    if (!/\.(js|jsx|css|json|html)$/.test(cleanPath)) {
      setError('Path must end with a valid extension (.html, .jsx, .js, .css, .json)');
      return;
    }

    if (existingFiles[cleanPath]) {
      setError(`A file at "${cleanPath}" already exists`);
      return;
    }

    onCreate(cleanPath, selectedTemplate.content);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="file-create-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="file-create-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-md glass-overlay rounded-2xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
            >
              <XIcon size={14} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="size-9 rounded-xl bg-surface-elevated border border-white/10 text-ink flex items-center justify-center">
                <FilePlusIcon size={16} />
              </div>
              <div>
                <h3 className="font-display text-base font-medium text-ink">Create New File</h3>
                <p className="text-xs text-ink-muted">
                  {isVanilla
                    ? 'HTML, CSS, JavaScript, and JSON templates'
                    : 'React components, styles, utilities, and data'}
                </p>
              </div>
            </div>

            {/* Template Picker */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplate.id === tmpl.id;
                const Icon = tmpl.icon;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-surface-active border-white/25 text-ink'
                        : 'bg-surface border-white/10 text-ink-muted hover:bg-surface-elevated hover:text-ink'
                    }`}
                  >
                    <Icon size={14} className={isSelected ? 'text-ink' : 'text-ink-muted'} />
                    <span>{tmpl.label}</span>
                  </button>
                );
              })}
            </div>

            {/* File Path Input */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1.5">
                  File Path (must start with /)
                </label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => {
                    setFilePath(e.target.value);
                    setError('');
                  }}
                  placeholder={isVanilla ? '/about.html or /scripts/main.js' : '/components/Header.jsx'}
                  autoFocus
                  className="w-full bg-canvas border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-ink font-mono outline-none transition-colors"
                />
                {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-elevated active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-ink hover:bg-white/90 text-canvas active:scale-95 transition cursor-pointer"
                >
                  Create File
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
