import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndFixCode,
  validateProject,
  validateRevisionContent,
} from '../services/codeValidator.js';
import { Project } from '../models/Project.js';

describe('Phase 2C: Generated Code Validation Suite', () => {

  describe('Task 1 & 3: JavaScript & JSX Syntax Validation', () => {
    it('validates and accepts well-formed JSX components', () => {
      const code = `
import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function HeroSection() {
  const [count, setCount] = useState(0);
  return (
    <div className='p-8 bg-white rounded-2xl shadow-sm'>
      <h1 className='text-3xl font-bold text-zinc-900'>Hero Title</h1>
      <button onClick={() => setCount(count + 1)} className='mt-4 flex items-center gap-2'>
        <Sparkles className='w-4 h-4' /> Clicked {count}
      </button>
    </div>
  );
}
`;
      const result = validateAndFixCode(code, '/components/HeroSection.js');
      assert.equal(result.valid, true, 'Valid JSX should pass validation');
      assert.equal(result.errors.length, 0);
      assert.ok(result.code.includes('export default function HeroSection'));
    });

    it('detects and flags malformed JSX with unclosed tags', () => {
      const malformedCode = `
import React from 'react';

export default function BrokenCard() {
  return (
    <div className='card'>
      <h2>Unclosed Header
    </div>
  );
}
`;
      const result = validateAndFixCode(malformedCode, '/components/BrokenCard.js');
      assert.equal(result.valid, false, 'Malformed JSX must fail validation');
      const syntaxError = result.errors.find((e) => e.type === 'syntax');
      assert.ok(syntaxError, 'Must record a structured syntax error');
      assert.match(syntaxError.message, /closing tag|Parse failed/i);
    });

    it('detects unclosed JSX expressions and syntax breaks', () => {
      const brokenSyntax = `
import React from 'react';

export default function SyntaxErrorComponent() {
  return (
    <div>{(() => { console.log('unclosed function') }</div>
  );
}
`;
      const result = validateAndFixCode(brokenSyntax, '/components/SyntaxErrorComponent.js');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.type === 'syntax'));
    });
  });

  describe('Task 4 & 6: Import Validation & Relative Path Resolution', () => {
    const plannedFiles = [
      { path: '/App.js', description: 'Entry point' },
      { path: '/styles.css', description: 'Styles' },
      { path: '/components/Header.js', description: 'Header navigation' },
      { path: '/components/Footer.js', description: 'Footer' },
    ];

    it('detects unresolvable relative imports to non-existent files', () => {
      const code = `
import React from 'react';
import Header from './components/Header';
import GhostSection from './components/GhostSection';

export default function App() {
  return (
    <div>
      <Header />
      <GhostSection />
    </div>
  );
}
`;
      const result = validateAndFixCode(code, '/App.js', { allPlannedFiles: plannedFiles });
      assert.equal(result.valid, false, 'Unresolvable relative import must fail validation');
      const importError = result.errors.find((e) => e.type === 'import');
      assert.ok(importError, 'Must record import error');
      assert.match(importError.message, /GhostSection/);
    });

    it('automatically corrects misrouted relative import paths when the file exists elsewhere in the plan', () => {
      const code = `
import React from 'react';
import Header from './Header'; // Actually planned at /components/Header.js

export default function App() {
  return <Header />;
}
`;
      const result = validateAndFixCode(code, '/App.js', { allPlannedFiles: plannedFiles });
      assert.equal(result.valid, true, 'Correctable import path should be repaired and validated');
      assert.ok(result.code.includes("import Header from './components/Header'"));
      assert.ok(result.warnings.some((w) => w.includes("Corrected import './Header'")));
    });
  });

  describe('Task 5: Export Verification & Safe Repair', () => {
    it('detects multiple default exports and rejects them', () => {
      const doubleExport = `
import React from 'react';

export default function Primary() {
  return <div>First</div>;
}

export default function Secondary() {
  return <div>Second</div>;
}
`;
      const result = validateAndFixCode(doubleExport, '/components/DoubleExport.js');
      assert.equal(result.valid, false);
      const exportError = result.errors.find((e) => e.type === 'export' || e.type === 'syntax');
      assert.ok(exportError, 'Must report multiple default exports error');
      assert.match(exportError.message, /multiple default exports/i);
    });

    it('safely auto-repairs missing default export when a clear PascalCase component exists', () => {
      const missingExport = `
import React from 'react';

function UserProfile({ name }) {
  return <div>Hello, {name}</div>;
}
`;
      const result = validateAndFixCode(missingExport, '/components/UserProfile.js');
      assert.equal(result.valid, true, 'Should auto-repair unambiguous missing default export');
      assert.ok(result.code.includes('export default UserProfile'));
      assert.ok(result.warnings.some((w) => w.includes('Added missing default export for \'UserProfile\'')));
    });

    it('flags an export error when a file has no components and no default export', () => {
      const noComponent = `
const x = 42;
const y = 99;
`;
      const result = validateAndFixCode(noComponent, '/components/NoComponent.js');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.type === 'export'));
    });
  });

  describe('Task 8: Invalid Dependencies & Unsupported Imports', () => {
    it('flags Node.js built-ins in client-side React code', () => {
      const nodeImportCode = `
import React from 'react';
import fs from 'fs';
import path from 'path';

export default function FileViewer() {
  return <div>{fs.existsSync('foo') ? 'yes' : 'no'}</div>;
}
`;
      const result = validateAndFixCode(nodeImportCode, '/components/FileViewer.js');
      assert.equal(result.valid, false);
      const depErrors = result.errors.filter((e) => e.type === 'dependency');
      assert.ok(depErrors.length >= 2, 'Should flag both fs and path');
      assert.match(depErrors[0].message, /Unsupported server\/Node\.js module/);
    });

    it('flags backend packages in client components', () => {
      const backendImportCode = `
import React from 'react';
import mongoose from 'mongoose';

export default function DatabaseWidget() {
  return <div>DB</div>;
}
`;
      const result = validateAndFixCode(backendImportCode, '/components/DatabaseWidget.js');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.type === 'dependency' && e.message.includes('mongoose')));
    });
  });

  describe('Task 7 & 6: Project-Level Validation & Component Contracts', () => {
    it('successfully validates a complete, well-formed multi-file project', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
import Header from './components/Header';
import './styles.css';

export default function App() {
  return (
    <div>
      <Header />
      <main>Hello World</main>
    </div>
  );
}
`,
        '/styles.css': `
body { margin: 0; font-family: sans-serif; }
`,
        '/components/Header.js': `
import React from 'react';

export default function Header() {
  return <header>Navigation</header>;
}
`,
      };

      const planned = [
        { path: '/App.js', description: 'Entry' },
        { path: '/styles.css', description: 'CSS' },
        { path: '/components/Header.js', description: 'Header' },
      ];

      const validation = validateProject(projectFiles, planned);
      assert.equal(validation.valid, true, 'Well-formed project must be valid');
      assert.equal(validation.errors.length, 0);
    });

    it('detects missing planned files in project validation', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
export default function App() { return <div>App</div>; }
`,
        '/styles.css': 'body {}',
      };

      const planned = [
        { path: '/App.js', description: 'Entry' },
        { path: '/styles.css', description: 'CSS' },
        { path: '/components/Hero.js', description: 'Hero section' }, // Missing!
      ];

      const validation = validateProject(projectFiles, planned);
      assert.equal(validation.valid, false);
      const missingError = validation.errors.find((e) => e.type === 'missing_file' && e.file === '/components/Hero.js');
      assert.ok(missingError, 'Must detect missing planned component');
    });

    it('detects contract violation when importing default from a module with no default export', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
import Header from './components/Header';

export default function App() {
  return <Header />;
}
`,
        '/styles.css': 'body {}',
        '/components/Header.js': `
import React from 'react';
export const Nav = () => <nav>Navbar</nav>;
// Missing default export!
`,
      };

      const validation = validateProject(projectFiles, []);
      assert.equal(validation.valid, false);
      const contractError = validation.errors.find((e) => e.type === 'contract' || e.type === 'export');
      assert.ok(contractError, 'Must flag contract violation on missing default export');
    });

    it('detects missing mandatory entry point /App.js', () => {
      const projectFiles = {
        '/styles.css': 'body {}',
        '/components/Header.js': 'import React from "react"; export default function Header() {}',
      };

      const validation = validateProject(projectFiles);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.type === 'missing_file' && e.file === '/App.js'));
    });
  });

  describe('Task 10: Backward Compatibility with Pre-DesignSpec Projects', () => {
    it('validates and preserves legacy project documents created before DesignSpec', () => {
      const legacyDoc = new Project({
        name: 'Legacy Project 2025',
        owner: '507f1f77bcf86cd799439011',
        files: {
          '/App.js': {
            content: 'import React from "react";\nexport default function App() {\n  return <h1>Legacy</h1>;\n}',
            hash: '12345',
          },
          '/styles.css': {
            content: 'body { background: #fafafa; }',
            hash: '67890',
          },
        },
      });

      assert.equal(legacyDoc.designSpec, null);

      // Validate legacy files
      const fileMap = {};
      for (const [p, f] of Object.entries(legacyDoc.files)) {
        fileMap[p] = f.content;
      }

      const result = validateProject(fileMap);
      assert.equal(result.valid, true, 'Legacy project files should validate cleanly');
      assert.equal(result.errors.length, 0);
    });

    it('validates revision operations with safe partial content', () => {
      const updateResult = validateRevisionContent(
        '<div class="box"><img src="pic.jpg"></div>',
        '/components/Card.js',
        'update',
      );

      assert.equal(updateResult.valid, true);
      assert.ok(updateResult.content.includes('className="box"'));
      assert.ok(updateResult.content.includes('<img src="pic.jpg" />'));
    });
  });
});

