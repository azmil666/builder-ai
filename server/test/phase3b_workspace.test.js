import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Phase 3B: Professional Website Builder Workspace Suite', () => {
  describe('Task 1: File Operations & Core Guardrails', () => {
    it('creates a new file with valid extension and path normalization', () => {
      const files = {
        '/App.js': { content: 'export default function App() {}' },
      };

      const createFile = (currentFiles, path, content = '') => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        if (currentFiles[normalized]) throw new Error('File already exists');
        if (!/\.(js|jsx|css|json|html)$/.test(normalized)) {
          throw new Error('Invalid file extension');
        }
        return {
          ...currentFiles,
          [normalized]: { content },
        };
      };

      const updated = createFile(files, 'components/Hero.jsx', 'export function Hero() {}');
      assert.ok(updated['/components/Hero.jsx']);
      assert.strictEqual(updated['/components/Hero.jsx'].content, 'export function Hero() {}');
    });

    it('prevents renaming or deleting primary entry point /App.js', () => {
      const renameFile = (oldPath, newPath) => {
        if (oldPath === '/App.js') {
          throw new Error('Cannot rename primary entry point /App.js');
        }
        return newPath;
      };

      const deleteFile = (path) => {
        if (path === '/App.js' || path === '/styles.css') {
          throw new Error(`Cannot delete core file ${path}`);
        }
        return true;
      };

      assert.throws(
        () => renameFile('/App.js', '/Root.js'),
        /Cannot rename primary entry point \/App\.js/,
      );
      assert.throws(
        () => deleteFile('/App.js'),
        /Cannot delete core file \/App\.js/,
      );
      assert.throws(
        () => deleteFile('/styles.css'),
        /Cannot delete core file \/styles\.css/,
      );
    });

    it('safely renames non-core file and updates path keys', () => {
      const files = {
        '/App.js': { content: 'app' },
        '/Button.jsx': { content: 'button' },
      };

      const rename = (currentFiles, oldPath, newPath) => {
        const file = currentFiles[oldPath];
        if (!file) throw new Error('File not found');
        const updated = { ...currentFiles };
        delete updated[oldPath];
        updated[newPath] = file;
        return updated;
      };

      const result = rename(files, '/Button.jsx', '/components/PrimaryButton.jsx');
      assert.strictEqual(result['/Button.jsx'], undefined);
      assert.ok(result['/components/PrimaryButton.jsx']);
      assert.strictEqual(result['/components/PrimaryButton.jsx'].content, 'button');
    });
  });

  describe('Task 2: Device Viewport Resolution', () => {
    it('resolves correct dimensions and frame constraints for device viewports', () => {
      const getViewportDimensions = (viewport) => {
        switch (viewport) {
          case 'mobile':
            return { width: '375px', isFrame: true, rounded: '32px' };
          case 'tablet':
            return { width: '768px', isFrame: true, rounded: '20px' };
          case 'desktop':
          default:
            return { width: '100%', isFrame: false, rounded: '0px' };
        }
      };

      const desktop = getViewportDimensions('desktop');
      assert.strictEqual(desktop.width, '100%');
      assert.strictEqual(desktop.isFrame, false);

      const tablet = getViewportDimensions('tablet');
      assert.strictEqual(tablet.width, '768px');
      assert.strictEqual(tablet.isFrame, true);

      const mobile = getViewportDimensions('mobile');
      assert.strictEqual(mobile.width, '375px');
      assert.strictEqual(mobile.isFrame, true);
    });
  });

  describe('Task 3: Safe Markdown & Codeblock Tokenization', () => {
    it('identifies code fences, language tags, and separates code lines', () => {
      const markdown = `
Here is the updated code:
\`\`\`jsx
import React from 'react';
export default function Card() {
  return <div className="p-4">Card</div>;
}
\`\`\`
Let me know if you need any adjustments.
`.trim();

      const parseCodeBlocks = (text) => {
        const blocks = [];
        const lines = text.split('\n');
        let inBlock = false;
        let lang = '';
        let buf = [];

        for (const line of lines) {
          if (line.startsWith('```')) {
            if (inBlock) {
              blocks.push({ language: lang, code: buf.join('\n') });
              inBlock = false;
              buf = [];
              lang = '';
            } else {
              inBlock = true;
              lang = line.slice(3).trim();
            }
            continue;
          }
          if (inBlock) {
            buf.push(line);
          }
        }
        return blocks;
      };

      const codeBlocks = parseCodeBlocks(markdown);
      assert.strictEqual(codeBlocks.length, 1);
      assert.strictEqual(codeBlocks[0].language, 'jsx');
      assert.ok(codeBlocks[0].code.includes('export default function Card()'));
    });

    it('identifies file references and formats them as interactive paths', () => {
      const text = 'I modified `/components/Navbar.jsx` and `/styles.css` for mobile.';
      const matches = [...text.matchAll(/`(\/[A-Za-z0-9_/-]+\.(js|jsx|css|json|html))`+/g)].map(
        (m) => m[1],
      );

      assert.deepStrictEqual(matches, ['/components/Navbar.jsx', '/styles.css']);
    });
  });

  describe('Task 4: Sync Status Management', () => {
    it('transitions between saved, saving, and error statuses predictably', () => {
      let status = 'saved';
      const onSaveStart = () => (status = 'saving');
      const onSaveSuccess = () => (status = 'saved');
      const onSaveFail = () => (status = 'error');

      assert.strictEqual(status, 'saved');
      onSaveStart();
      assert.strictEqual(status, 'saving');
      onSaveSuccess();
      assert.strictEqual(status, 'saved');
      onSaveStart();
      assert.strictEqual(status, 'saving');
      onSaveFail();
      assert.strictEqual(status, 'error');
    });
  });

  describe('Task 5: Left Activity Rail Tab Navigation', () => {
    it('manages 4 distinct activity tabs and collapse toggle', () => {
      const validTabs = ['chat', 'files', 'design', 'settings'];
      let activeTab = 'chat';
      let isCollapsed = false;

      const clickTab = (tab) => {
        assert.ok(validTabs.includes(tab));
        if (activeTab === tab && !isCollapsed) {
          isCollapsed = true;
        } else {
          activeTab = tab;
          isCollapsed = false;
        }
      };

      assert.strictEqual(activeTab, 'chat');
      assert.strictEqual(isCollapsed, false);

      clickTab('files');
      assert.strictEqual(activeTab, 'files');
      assert.strictEqual(isCollapsed, false);

      // Clicking active tab collapses sidebar
      clickTab('files');
      assert.strictEqual(isCollapsed, true);

      // Clicking another tab expands sidebar to that tab
      clickTab('design');
      assert.strictEqual(activeTab, 'design');
      assert.strictEqual(isCollapsed, false);
    });
  });
});

