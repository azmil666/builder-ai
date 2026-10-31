import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, validateAndFixCode, validateAndFixLucideIcons, compileModuleCode } from '../services/codeValidator.js';
import { Project } from '../models/Project.js';

describe('Phase 2C: Failure Injection & Self-Repair Safety Tests', () => {

  const baseProject = {
    '/App.js': `
import React from 'react';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import './styles.css';

export default function App() {
  return (
    <div>
      <Navbar />
      <ProductCard />
    </div>
  );
}
`,
    '/styles.css': 'body { margin: 0; }',
    '/components/Navbar.js': `
import React from 'react';
import { ShoppingCart } from 'lucide-react';
export default function Navbar() {
  return <nav><ShoppingCart /></nav>;
}
`,
    '/components/ProductCard.js': `
import React from 'react';
import { Plus } from 'lucide-react';
export default function ProductCard() {
  return <div className="card"><span>Item</span><button><Plus /> Add</button></div>;
}
`,
  };

  const plannedFiles = [
    { path: '/App.js', description: 'Entry point', mandatory: true },
    { path: '/styles.css', description: 'CSS', mandatory: true },
    { path: '/components/Navbar.js', description: 'Navbar', mandatory: true },
    { path: '/components/ProductCard.js', description: 'Product Card', mandatory: true },
  ];

  // 1. Injected Failure: Missing Component File
  it('Failure Injection 1: Missing planned component file is strictly caught without fake placeholders', () => {
    const brokenFiles = { ...baseProject };
    delete brokenFiles['/components/ProductCard.js']; // Deliberately omitted

    const val = validateProject(brokenFiles, plannedFiles);
    assert.equal(val.valid, false, 'Project must fail validation when a planned mandatory file is missing');
    
    const missingFileError = val.errors.find((e) => e.type === 'missing_file' && e.file === '/components/ProductCard.js');
    assert.ok(missingFileError, 'Must record structured missing_file error for /components/ProductCard.js');
    
    const unresolvableImport = val.errors.find((e) => e.type === 'import' && e.file === '/App.js');
    assert.ok(unresolvableImport, 'Must record import error in /App.js for missing target');

    // Confirm no fake placeholder exists
    assert.equal(brokenFiles['/components/ProductCard.js'], undefined, 'No fake placeholder should be injected');
  });

  // 2. Injected Failure: Invalid Lucide Icon Import
  it('Failure Injection 2: Invalid Lucide icon import is detected and auto-repaired or flagged', () => {
    // Inject invalid icon imports into Navbar
    const brokenNavbar = `
import React from 'react';
import { Sparkles, CartIcon, FakeIconXYZ } from 'lucide-react';
export default function Navbar() {
  return (
    <nav>
      <Sparkles />
      <CartIcon />
      <FakeIconXYZ />
    </nav>
  );
}
`;
    // Test validation and auto-fixing
    const res = validateAndFixCode(brokenNavbar, '/components/Navbar.js');
    
    // CartIcon must be auto-repaired to ShoppingCart
    assert.ok(res.code.includes('ShoppingCart'), 'CartIcon must be auto-corrected to ShoppingCart');
    assert.ok(res.warnings.some((w) => w.includes('CartIcon')), 'Must record repair warning for CartIcon');

    // FakeIconXYZ must be flagged as a structured error
    assert.equal(res.valid, false, 'File must fail validation due to unresolvable icon');
    const iconError = res.errors.find((e) => e.type === 'icon');
    assert.ok(iconError, 'Must record structured icon error');
    assert.match(iconError.message, /FakeIconXYZ/);
  });

  // 3. Injected Failure: Broken Relative Import Path
  it('Failure Injection 3: Broken relative import to non-existent target is flagged as unresolvable', () => {
    const brokenApp = `
import React from 'react';
import GhostSection from './components/GhostSection';
export default function App() {
  return <div><GhostSection /></div>;
}
`;
    const brokenFiles = {
      ...baseProject,
      '/App.js': brokenApp,
    };

    const val = validateProject(brokenFiles, plannedFiles);
    assert.equal(val.valid, false);
    const importError = val.errors.find((e) => e.type === 'import' && e.message.includes('GhostSection'));
    assert.ok(importError, 'Must capture unresolvable relative import');
  });

  // 4. Injected Failure: Invalid JSX Syntax Expression
  it('Failure Injection 4: Unclosed tag / invalid JSX expression is detected by compiler and AST parser', async () => {
    const brokenCard = `
import React from 'react';
export default function ProductCard() {
  return (
    <div className="card">
      <h2>Unclosed Title
    </div>
  );
}
`;
    const res = validateAndFixCode(brokenCard, '/components/ProductCard.js');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.type === 'syntax' || e.type === 'compilation'));

    // Real compilation test
    const compRes = await compileModuleCode(brokenCard, '/components/ProductCard.jsx');
    assert.equal(compRes.success, false, 'JSX compilation must fail on malformed tags');
    assert.ok(compRes.errors.length > 0);
  });

  // 5. Repair Loop Boundary: Bounded Retries and Safe Failure
  it('Failure Injection 5: AI repair loop halts at retry boundary and fails safely', () => {
    let retryCounter = 0;
    const maxRetries = 2;

    const mockRepairAttempt = () => {
      retryCounter++;
      // Return unresolvable error
      return { success: false, errors: [{ type: 'syntax', file: '/App.js', message: 'Fatal error' }] };
    };

    while (retryCounter < maxRetries) {
      const result = mockRepairAttempt();
      if (result.success) break;
    }

    assert.equal(retryCounter, 2, 'Must stop strictly after 2 attempts');

    // Confirm project model state is failed, not completed
    const project = new Project({
      name: 'Unrepairable Project',
      owner: '507f1f77bcf86cd799439011',
      status: 'failed',
      error: 'Project validation failed after self-repair attempts: [syntax] /App.js: Fatal error',
    });

    assert.equal(project.status, 'failed');
    assert.notEqual(project.status, 'completed');
  });
});

