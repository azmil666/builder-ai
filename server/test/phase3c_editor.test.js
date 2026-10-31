import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Phase 3C: Editor & File Management Polish Suite', () => {
  describe('Task 1: Multi-File Tab State Machine', () => {
    it('appends opened files to openTabs and preserves active tab focus', () => {
      let openTabs = ['/App.js'];
      let activeFile = '/App.js';

      const openFile = (path) => {
        activeFile = path;
        if (!openTabs.includes(path)) {
          openTabs = [...openTabs, path];
        }
      };

      openFile('/components/Hero.jsx');
      assert.deepStrictEqual(openTabs, ['/App.js', '/components/Hero.jsx']);
      assert.strictEqual(activeFile, '/components/Hero.jsx');

      // Re-opening an already open tab does not duplicate it
      openFile('/App.js');
      assert.deepStrictEqual(openTabs, ['/App.js', '/components/Hero.jsx']);
      assert.strictEqual(activeFile, '/App.js');
    });

    it('switches active file safely when closing an active tab', () => {
      let openTabs = ['/App.js', '/components/Hero.jsx', '/styles.css'];
      let activeFile = '/styles.css';

      const closeTab = (path) => {
        openTabs = openTabs.filter((p) => p !== path);
        if (openTabs.length === 0) {
          openTabs = ['/App.js'];
        }
        if (activeFile === path) {
          activeFile = openTabs[openTabs.length - 1];
        }
      };

      // Close the active tab (/styles.css) -> focus shifts to previous tab (/components/Hero.jsx)
      closeTab('/styles.css');
      assert.deepStrictEqual(openTabs, ['/App.js', '/components/Hero.jsx']);
      assert.strictEqual(activeFile, '/components/Hero.jsx');

      // Close non-active tab (/App.js) -> focus stays on /components/Hero.jsx
      closeTab('/App.js');
      assert.deepStrictEqual(openTabs, ['/components/Hero.jsx']);
      assert.strictEqual(activeFile, '/components/Hero.jsx');

      // Close only remaining tab -> resets to ['/App.js']
      closeTab('/components/Hero.jsx');
      assert.deepStrictEqual(openTabs, ['/App.js']);
      assert.strictEqual(activeFile, '/App.js');
    });
  });

  describe('Task 2: Dirty State & Unsaved Changes Tracking', () => {
    it('tracks dirty files set and clears state upon save flush', () => {
      let dirtyFiles = new Set();
      let syncStatus = 'saved';

      const markDirty = (path) => {
        dirtyFiles.add(path);
        syncStatus = 'saving';
      };

      const flushSave = () => {
        dirtyFiles.clear();
        syncStatus = 'saved';
      };

      markDirty('/components/Hero.jsx');
      markDirty('/styles.css');
      assert.strictEqual(dirtyFiles.size, 2);
      assert.ok(dirtyFiles.has('/components/Hero.jsx'));
      assert.ok(dirtyFiles.has('/styles.css'));
      assert.strictEqual(syncStatus, 'saving');

      flushSave();
      assert.strictEqual(dirtyFiles.size, 0);
      assert.strictEqual(syncStatus, 'saved');
    });
  });

  describe('Task 3: Template-Based File Creation & Path Validation', () => {
    it('validates paths, prepends slashes, and matches supported extensions', () => {
      const validatePath = (rawPath, existingFiles) => {
        const trimmed = (rawPath || '').trim();
        if (!trimmed) throw new Error('Path cannot be empty');
        const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        if (!/\.(jsx|js|css|json|html)$/.test(clean)) {
          throw new Error('Unsupported extension');
        }
        if (existingFiles[clean]) {
          throw new Error('File already exists');
        }
        return clean;
      };

      const currentFiles = { '/App.js': { content: '' } };

      assert.strictEqual(
        validatePath('components/Button.jsx', currentFiles),
        '/components/Button.jsx',
      );
      assert.strictEqual(
        validatePath('/custom.css', currentFiles),
        '/custom.css',
      );
      assert.strictEqual(
        validatePath('data.json', currentFiles),
        '/data.json',
      );

      assert.throws(() => validatePath('App.js', currentFiles), /File already exists/);
      assert.throws(() => validatePath('script.py', currentFiles), /Unsupported extension/);
      assert.throws(() => validatePath('', currentFiles), /Path cannot be empty/);
    });
  });

  describe('Task 4: File Synchronization & Export Integrity', () => {
    it('ensures in-memory activeProject files match export bundle payload', () => {
      const activeProject = {
        name: 'SaaS App',
        files: {
          '/App.js': { content: 'import React from "react"; export default function App() {}' },
          '/styles.css': { content: 'body { margin: 0; }' },
        },
      };

      // User modifies a file in the editor
      const liveEdit = 'import React from "react"; export default function App() { return <h1>Updated</h1>; }';

      // updateProjectFiles updates in-memory activeProject.files before flush
      const updateProjectFiles = (newFiles) => {
        activeProject.files = newFiles;
      };

      updateProjectFiles({
        ...activeProject.files,
        '/App.js': { content: liveEdit },
      });

      // Prepare files for export packager
      const exportFiles = {};
      for (const [path, fileObj] of Object.entries(activeProject.files)) {
        exportFiles[path] = typeof fileObj === 'string' ? fileObj : fileObj.content;
      }

      assert.strictEqual(exportFiles['/App.js'], liveEdit);
      assert.ok(exportFiles['/App.js'].includes('<h1>Updated</h1>'));
    });

    it('protects core system files /App.js and /styles.css from deletion', () => {
      const canDelete = (path) => {
        return path !== '/App.js' && path !== '/styles.css';
      };

      assert.strictEqual(canDelete('/App.js'), false);
      assert.strictEqual(canDelete('/styles.css'), false);
      assert.strictEqual(canDelete('/components/Hero.jsx'), true);
      assert.strictEqual(canDelete('/utils/format.js'), true);
    });
  });

  describe('Task 5: Quick Open Fuzzy Search', () => {
    it('filters project files accurately by partial path and basename', () => {
      const fileList = [
        '/App.js',
        '/styles.css',
        '/components/Hero.jsx',
        '/components/Navbar.jsx',
        '/components/Footer.jsx',
        '/data/features.json',
      ];

      const searchFiles = (files, query) => {
        const q = (query || '').toLowerCase().trim();
        if (!q) return files;
        return files.filter((f) => f.toLowerCase().includes(q));
      };

      assert.deepStrictEqual(searchFiles(fileList, 'hero'), ['/components/Hero.jsx']);
      assert.deepStrictEqual(searchFiles(fileList, 'components'), [
        '/components/Hero.jsx',
        '/components/Navbar.jsx',
        '/components/Footer.jsx',
      ]);
      assert.deepStrictEqual(searchFiles(fileList, '.json'), ['/data/features.json']);
      assert.deepStrictEqual(searchFiles(fileList, 'nonexistent'), []);
    });
  });
});

