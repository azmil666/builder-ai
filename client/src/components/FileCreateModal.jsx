import React, { useState } from 'react';
import {
  CodeIcon,
  FileCodeIcon,
  FilePlusIcon,
  FileTextIcon,
  XIcon,
} from 'lucide-react';

const FILE_TEMPLATES = [
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
  onCreate,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(FILE_TEMPLATES[0]);
  const [filePath, setFilePath] = useState(FILE_TEMPLATES[0].defaultPath);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
      setError('Path must end with a valid extension (.jsx, .js, .css, .json)');
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
        >
          <XIcon size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <FilePlusIcon size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Create New File</h3>
            <p className="text-xs text-zinc-400">Choose a starter template or custom path</p>
          </div>
        </div>

        {/* Template Picker */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {FILE_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleTemplateSelect(tmpl)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-indigo-400' : 'text-zinc-500'} />
                <span>{tmpl.label}</span>
              </button>
            );
          })}
        </div>

        {/* File Path Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">
              File Path (must start with /)
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => {
                setFilePath(e.target.value);
                setError('');
              }}
              placeholder="/components/Header.jsx"
              autoFocus
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none transition"
            />
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
            >
              Create File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

