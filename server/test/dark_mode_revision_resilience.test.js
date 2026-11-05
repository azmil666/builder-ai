import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndFixCode, validatePropContracts, verifyProjectRuntime } from '../services/codeValidator.js';
import { applyOperations, searchReplace } from '../services/diff.js';
import { chat } from '../controllers/chatController.js';
import { Project } from '../models/Project.js';
import { getGeminiClient, resetGeminiClient } from '../services/gemini.js';

describe('Dark Mode & Revision Failure Resilience Suite', () => {
  describe('1. Defensive Theme Defaults in validateAndFixCode', () => {
    it('automatically injects safe fallback defaults for setDarkMode and onToggleDarkMode in function declaration', () => {
      const input = `export default function Navbar({ darkMode, setDarkMode, onToggleDarkMode }) {
        return (
          <nav>
            <button onClick={() => setDarkMode(!darkMode)}>Toggle</button>
          </nav>
        );
      }`;

      const result = validateAndFixCode(input, '/components/Navbar.js');
      assert.ok(result.code.includes('setDarkMode = () => {}'));
      assert.ok(result.code.includes('onToggleDarkMode = () => {}'));
      assert.ok(result.code.includes('darkMode = false'));
    });

    it('automatically injects safe fallback defaults in arrow function declaration', () => {
      const input = `const Navbar = ({ isDarkMode, setIsDarkMode, toggleDarkMode }) => {
        return <button onClick={() => setIsDarkMode(!isDarkMode)}>Toggle</button>;
      };
      export default Navbar;`;

      const result = validateAndFixCode(input, '/components/Navbar.js');
      assert.ok(result.code.includes('setIsDarkMode = () => {}'));
      assert.ok(result.code.includes('toggleDarkMode = () => {}'));
      assert.ok(result.code.includes('isDarkMode = false'));
    });

    it('safely handles multiline parameters and nested destructuring without corrupting code', () => {
      const input = `export default function Navbar({
        cart,
        darkMode,
        user: { name, avatar } = {},
        existingConfig = { theme: 'dark' }
      }) {
        return <nav>{name}</nav>;
      }`;

      const result = validateAndFixCode(input, '/components/Navbar.js');
      assert.ok(result.code.includes('cart = []'));
      assert.ok(result.code.includes('darkMode = false'));
      assert.ok(result.code.includes('user: { name, avatar } = {}'), 'Nested destructuring must be preserved');
      assert.ok(result.code.includes("existingConfig = { theme: 'dark' }"), 'Existing default must not be overwritten');
    });
  });

  describe('2. AST Prop Contract Detection for Theme Function Props', () => {
    it('detects when parent App.js fails to pass setDarkMode or onToggleDarkMode called by Navbar', () => {
      const files = {
        '/App.js': `import React from 'react';
import Navbar from './components/Navbar';
export default function App() {
  return <div><Navbar /></div>;
}`,
        '/components/Navbar.js': `import React from 'react';
export default function Navbar({ darkMode, setDarkMode }) {
  return <button onClick={() => setDarkMode(!darkMode)}>Toggle</button>;
}`,
      };

      const result = validatePropContracts(files);
      const mismatch = result.errors.find((e) => e.component === 'Navbar' && e.prop === 'setDarkMode');
      assert.ok(mismatch, 'Should flag missing setDarkMode prop in <Navbar />');
    });

    it('accepts prop aliases like onToggleDarkMode when Navbar calls setDarkMode', () => {
      const files = {
        '/App.js': `import React, { useState } from 'react';
import Navbar from './components/Navbar';
export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  return (
    <div className={darkMode ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900'}>
      <Navbar darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />
    </div>
  );
}`,
        '/components/Navbar.js': `import React from 'react';
export default function Navbar({ darkMode = false, setDarkMode = () => {} }) {
  return <button onClick={() => setDarkMode(!darkMode)}>Toggle</button>;
}`,
      };

      const result = validatePropContracts(files);
      const mismatch = result.errors.find((e) => e.component === 'Navbar' && e.prop === 'setDarkMode');
      assert.equal(mismatch, undefined, 'Alias onToggleDarkMode should satisfy setDarkMode requirement');
    });
  });

  describe('3. Reliable Edit Strategy in Diff Engine', () => {
    it('applyOperations allows update operation with full content replacement', () => {
      const initialFiles = {
        '/components/Navbar.js': {
          content: 'export default function Navbar() { return <nav>Old</nav>; }',
          hash: 'hash1',
        },
      };

      const operations = [
        {
          op: 'update',
          path: '/components/Navbar.js',
          content: 'export default function Navbar({ darkMode = false, setDarkMode = () => {} }) { return <nav>Updated with Dark Mode</nav>; }',
        },
      ];

      const { files, applied, errors } = applyOperations(initialFiles, operations);
      assert.equal(errors.length, 0);
      assert.equal(applied.length, 1);
      assert.ok(files['/components/Navbar.js'].content.includes('Updated with Dark Mode'));
    });

    it('searchReplace handles trimmed multiline matching', () => {
      const content = `function App() {
  const [count, setCount] = useState(0);
  return <div>Hello</div>;
}`;

      const search = `
  const [count, setCount] = useState(0);
  return <div>Hello</div>;
`;
      const replace = `  const [darkMode, setDarkMode] = useState(false);\n  return <div className={darkMode ? "dark" : ""}>Hello</div>;`;

      const replaced = searchReplace(content, search, replace);
      assert.ok(replaced, 'searchReplace should match despite outer whitespace');
      assert.ok(replaced.includes('setDarkMode'));
    });
  });

  describe('4. Revision Failure Handling in Chat Controller', () => {
    it('does NOT increment version and preserves existing files when revision operations fail', async () => {
      let savedProject = null;
      const initialContent = 'export default function App() { return <div>Original Content</div>; }';

      const mockProject = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Project',
        description: 'Test description',
        version: 3,
        status: 'completed',
        files: {
          '/App.js': {
            content: initialContent,
            hash: 'origHash',
          },
        },
        messages: [],
        designSpec: null,
        markModified: () => {},
        save: async function () {
          savedProject = this;
        },
      };

      const originalFindOne = Project.findOne;
      Project.findOne = async () => mockProject;

      const originalKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForRevisionTest1234567890';
      resetGeminiClient();
      const geminiClient = getGeminiClient();

      geminiClient.models.generateContent = async () => ({
        candidates: [{ finishReason: 'STOP' }],
        text: JSON.stringify({
          operations: [
            {
              op: 'update',
              path: '/App.js',
              search: 'NON_EXISTENT_SEARCH_STRING_FOR_FAIL_TEST',
              replace: 'REPLACEMENT',
            },
          ],
          description: 'Failing revision attempt',
        }),
      });

      let responseStatus = null;
      let responseJson = null;

      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
        body: { prompt: 'Make changes' },
        user: { userId: 'user123' },
      };

      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (payload) => {
              responseJson = payload;
            },
          };
        },
        json: (payload) => {
          responseStatus = 200;
          responseJson = payload;
        },
      };

      try {
        await chat(req, res);
      } finally {
        Project.findOne = originalFindOne;
        process.env.GEMINI_API_KEY = originalKey;
        resetGeminiClient();
      }

      // If AI fails to produce matching operations, version must remain 3
      assert.equal(savedProject.version, 3, 'Project version must not be incremented on revision failure');
      assert.equal(
        savedProject.files['/App.js'].content,
        initialContent,
        'Original file content must be preserved'
      );
      assert.equal(responseStatus, 422, 'Response status must be 422 Unprocessable Entity');
      assert.ok(responseJson.error.includes('Revision failed'), 'Response error must clearly indicate failure');
      assert.ok(
        savedProject.messages.some((m) => m.content.includes('❌ Revision failed')),
        'Messages should track the failed revision attempt'
      );
    });
  });

  describe('5. Active Runtime & Whole-Page Dark Mode Theme Changes', () => {
    it('verifies that whole page container responds to darkMode state without console errors', async () => {
      const files = {
        '/App.js': `import React, { useState } from 'react';
import Navbar from './components/Navbar';
export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const toggleDarkMode = () => setDarkMode(prev => !prev);
  return (
    <div className={'min-h-screen transition-colors duration-300 ' + (darkMode ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900')}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} onToggleDarkMode={toggleDarkMode} />
      <main className="p-8">
        <h1 className="text-3xl font-bold">Theme Test</h1>
        <p className={darkMode ? 'text-zinc-400' : 'text-zinc-600'}>Whole page reflects dark mode state</p>
      </main>
    </div>
  );
}`,
        '/components/Navbar.js': `import React from 'react';
import { Sun, Moon } from 'lucide-react';
export default function Navbar({ darkMode = false, setDarkMode = () => {}, onToggleDarkMode }) {
  const handleToggle = () => {
    if (typeof onToggleDarkMode === 'function') {
      onToggleDarkMode();
    } else if (typeof setDarkMode === 'function') {
      setDarkMode(!darkMode);
    }
  };
  return (
    <header className={darkMode ? 'bg-zinc-900 border-b border-zinc-800' : 'bg-white border-b border-zinc-200'}>
      <div className="flex items-center justify-between p-4">
        <span className="font-semibold">Logo</span>
        <button onClick={handleToggle} aria-label="Toggle dark mode" className="p-2 rounded-lg">
          {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-zinc-700" />}
        </button>
      </div>
    </header>
  );
}`,
        '/styles.css': `
          .dark { color-scheme: dark; }
        `,
      };

      const runtimeResult = await verifyProjectRuntime(files);
      assert.equal(runtimeResult.valid, true);
      assert.equal(runtimeResult.errors.length, 0, 'Should compile and mount cleanly in active-state runtime');
    });
  });
});
