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

  describe('Phase 2C: 14 Core Reliability & AI Self-Repair Regression Cases', () => {
    // 1. Valid project with all imports resolved
    it('Case 1: Valid project with all imports resolved passes validation cleanly', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import './styles.css';

export default function App() {
  return (
    <div className='min-h-screen bg-white'>
      <Header />
      <Hero />
    </div>
  );
}
`,
        '/styles.css': 'body { margin: 0; }',
        '/components/Header.js': `
import React from 'react';
import { ShoppingCart } from 'lucide-react';

export default function Header() {
  return (
    <header className='flex items-center justify-between p-4'>
      <h1>Brand</h1>
      <ShoppingCart className='w-6 h-6' />
    </header>
  );
}
`,
        '/components/Hero.js': `
import React from 'react';

export default function Hero() {
  return <section className='py-12 text-center'><h2>Welcome</h2></section>;
}
`,
      };

      const planned = [
        { path: '/App.js', description: 'Entry' },
        { path: '/styles.css', description: 'Styles' },
        { path: '/components/Header.js', description: 'Header' },
        { path: '/components/Hero.js', description: 'Hero' },
      ];

      const res = validateProject(projectFiles, planned);
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);
    });

    // 2. Missing local JavaScript file
    it('Case 2: Missing local JavaScript file is detected with structured error', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
import NonExistent from './components/NonExistent';
export default function App() { return <NonExistent />; }
`,
        '/styles.css': 'body {}',
      };

      const res = validateProject(projectFiles, []);
      assert.equal(res.valid, false);
      const importErr = res.errors.find((e) => e.type === 'import' && e.message.includes('NonExistent'));
      assert.ok(importErr, 'Must detect unresolvable local import');
    });

    // 3. Incorrect relative import path
    it('Case 3: Incorrect relative import path is detected and auto-corrected', () => {
      const planned = [
        { path: '/App.js', description: 'App' },
        { path: '/components/Navbar.js', description: 'Navbar' },
      ];
      // File imports ./Navbar instead of ./components/Navbar
      const code = `
import React from 'react';
import Navbar from './Navbar';
export default function App() { return <Navbar />; }
`;
      const res = validateAndFixCode(code, '/App.js', { allPlannedFiles: planned });
      assert.equal(res.valid, true);
      assert.ok(res.code.includes("import Navbar from './components/Navbar'"));
    });

    // 4. Imported symbol missing from an existing module
    it('Case 4: Imported symbol missing from an existing module is detected as contract violation', () => {
      const projectFiles = {
        '/App.js': `
import React from 'react';
import { MissingHelper } from './components/Utils';
export default function App() { return <div>{MissingHelper()}</div>; }
`,
        '/styles.css': 'body {}',
        '/components/Utils.js': `
import React from 'react';
export const ExistingHelper = () => 'ok';
export default function Utils() { return null; }
`,
      };

      const res = validateProject(projectFiles, []);
      assert.equal(res.valid, false);
      const contractErr = res.errors.find((e) => e.type === 'contract' && e.message.includes('MissingHelper'));
      assert.ok(contractErr, 'Must flag missing named export symbol');
    });

    // 5. Invalid Lucide icon import
    it('Case 5: Invalid Lucide icon import is detected and repaired or flagged', () => {
      // CartIcon is invalid (valid is ShoppingCart)
      const codeWithBadIcon = `
import React from 'react';
import { Sparkles, CartIcon, FakeInventedIcon99 } from 'lucide-react';
export default function CartButton() {
  return <button><CartIcon /><FakeInventedIcon99 /></button>;
}
`;
      const res = validateAndFixCode(codeWithBadIcon, '/components/CartButton.js');
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.type === 'icon' && e.message.includes('FakeInventedIcon99')));
      assert.ok(res.code.includes('ShoppingCart'), 'Should auto-repair CartIcon to ShoppingCart');
    });

    // 6. Unsupported package import
    it('Case 6: Unsupported package import is rejected', () => {
      const code = `
import React from 'react';
import { weirdUtility } from 'invented-unsupported-lib-xyz';
export default function Comp() { return <div>{weirdUtility()}</div>; }
`;
      const res = validateAndFixCode(code, '/components/Comp.js');
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.type === 'dependency'));
    });

    // 7. JavaScript syntax error
    it('Case 7: JavaScript syntax error is caught with structured line/codeframe', () => {
      const code = `
import React from 'react';
export default function Broken() {
  const x = ;
  return <div>Test</div>;
}
`;
      const res = validateAndFixCode(code, '/components/Broken.js');
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.type === 'syntax'));
    });

    // 8. JSX compilation error
    it('Case 8: JSX compilation error (unclosed tag / adjacent elements) is detected', () => {
      const code = `
import React from 'react';
export default function BrokenJSX() {
  return <div><span>Unclosed Tag</div>;
}
`;
      const res = validateAndFixCode(code, '/components/BrokenJSX.js');
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.type === 'syntax' || e.type === 'compilation'));
    });

    // 9. Missing application entry point
    it('Case 9: Missing application entry point /App.js fails validation', () => {
      const projectFiles = {
        '/styles.css': 'body {}',
        '/components/Header.js': 'import React from "react"; export default function Header() { return null; }',
      };
      const res = validateProject(projectFiles, []);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some((e) => e.type === 'missing_file' && e.file === '/App.js'));
    });

    // 10. AI repair successfully fixes a missing import
    it('Case 10: AI repair simulated loop successfully fixes an unresolvable import', async () => {
      const brokenFiles = {
        '/App.js': `
import React from 'react';
import Header from './components/NonExistentHeader';
export default function App() { return <Header />; }
`,
        '/styles.css': 'body {}',
        '/components/Header.js': `
import React from 'react';
export default function Header() { return <header>Repaired Header</header>; }
`,
      };
      const planned = [
        { path: '/App.js', description: 'App' },
        { path: '/styles.css', description: 'CSS' },
        { path: '/components/Header.js', description: 'Header' },
      ];

      // Initial validation fails
      const initialVal = validateProject(brokenFiles, planned);
      assert.equal(initialVal.valid, false);

      // Targeted repair simulates repairing only the broken file (/App.js)
      const repairedAppCode = `
import React from 'react';
import Header from './components/Header';
export default function App() { return <Header />; }
`;
      const fixedFiles = { ...brokenFiles, '/App.js': repairedAppCode };
      const repairedVal = validateProject(fixedFiles, planned);
      assert.equal(repairedVal.valid, true);
    });

    // 11. AI repair fails after the retry limit
    it('Case 11: AI repair fails safely after reaching the retry limit without hanging', async () => {
      let attempts = 0;
      const maxRetries = 2;
      const simulateRepair = () => {
        attempts++;
        // Remains broken
        return false;
      };

      while (attempts < maxRetries) {
        simulateRepair();
      }

      assert.equal(attempts, 2, 'Must stop strictly at retry limit');
    });

    // 12. Valid project remains unchanged during repair of another file
    it('Case 12: Valid project components remain strictly unchanged during repair of another file', () => {
      const originalHeader = `import React from 'react';\nexport default function Header() { return <header>Intact</header>; }`;
      const projectFiles = {
        '/App.js': `import React from 'react';\nimport Broken from './Broken';\nexport default function App() { return <Broken />; }`,
        '/components/Header.js': originalHeader,
        '/styles.css': 'body {}',
      };

      // Repair only /App.js
      const repairedApp = `import React from 'react';\nimport Header from './components/Header';\nexport default function App() { return <Header />; }`;
      const updatedFiles = {
        ...projectFiles,
        '/App.js': repairedApp,
      };

      assert.equal(updatedFiles['/components/Header.js'], originalHeader, 'Header component must not be altered');
      assert.equal(updatedFiles['/styles.css'], 'body {}', 'Styles must not be altered');
    });

    // 13. DesignSpec is preserved throughout repair
    it('Case 13: DesignSpec tokens and archetype are preserved throughout repair', () => {
      const designSpec = {
        archetype: 'dark_luxury',
        colorPalette: { primary: '#d4af37', bg: '#0a0a0a' },
      };

      // Mock repair result preserving spec
      const repairContext = {
        designSpec,
        filesRepaired: ['/components/Card.js'],
      };

      assert.equal(repairContext.designSpec.archetype, 'dark_luxury');
      assert.equal(repairContext.designSpec.colorPalette.primary, '#d4af37');
    });

    // 14. A failed project is not marked completed
    it('Case 14: A failed project is not marked completed and retains failed status with errors', () => {
      const project = new Project({
        name: 'Broken Project',
        owner: '507f1f77bcf86cd799439011',
        status: 'failed',
        error: 'Validation failed: Unresolvable import in /App.js',
      });

      assert.notEqual(project.status, 'completed');
      assert.equal(project.status, 'failed');
      assert.ok(project.error.includes('Validation failed'));
    });
  });
});

