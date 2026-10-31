import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Post-generation code validator, AST parser, and auto-fixer
// Combines safe pre-normalization repairs with rigorous AST-based syntax and semantic validation.

// Void HTML elements that must be self-closed in JSX
const VOID_ELEMENTS = [
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"
];

// Pinned, verified compatible versions pre-cached on CodeSandbox packager CDN
export const DEFAULT_PACKAGE_VERSIONS = {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "lucide-react": "^0.469.0",
  "canvas-confetti": "^1.9.3",
  "framer-motion": "^11.15.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "date-fns": "^3.6.0",
  "moment": "^2.30.1",
  "lodash": "^4.17.21",
  "lodash-es": "^4.17.21",
  "recharts": "^2.15.0",
  "zustand": "^4.5.5",
  "axios": "^1.7.9",
  "prismjs": "^1.29.0",
};

// Node.js built-in modules and server-only packages that break in browser/Sandpack
export const FORBIDDEN_CLIENT_MODULES = new Set([
  "fs", "node:fs", "path", "node:path", "child_process", "node:child_process",
  "os", "node:os", "crypto", "node:crypto", "http", "node:http",
  "https", "node:https", "net", "node:net", "dns", "node:dns",
  "stream", "node:stream", "buffer", "node:buffer", "process", "node:process",
  "express", "mongoose", "dotenv", "bcrypt", "jsonwebtoken",
  "@ai-sdk/openai", "ai"
]);

// Explicitly supported browser packages for Sandpack preview
export const SUPPORTED_PACKAGES = new Set([
  ...Object.keys(DEFAULT_PACKAGE_VERSIONS),
  "react/jsx-runtime",
]);

// Standard npm package name regex (supports scoped @scope/pkg and unscoped pkg)
const NPM_PACKAGE_NAME_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Validates whether a package name is structurally valid according to npm package naming rules.
 */
export function isValidNpmPackageName(pkgName) {
  if (!pkgName || typeof pkgName !== "string") return false;
  if (pkgName.length > 214) return false;
  if (pkgName.startsWith(".") || pkgName.startsWith("_")) return false;
  if (FORBIDDEN_CLIENT_MODULES.has(pkgName)) return false;
  return NPM_PACKAGE_NAME_REGEX.test(pkgName);
}

/**
 * Validates whether a version specification is a valid semver string or range.
 */
export function isValidSemverSpec(version) {
  if (!version || typeof version !== "string") return false;
  const trimmed = version.trim();
  if (!trimmed || trimmed.length > 50) return false;
  const SEMVER_SPEC_REGEX = /^(latest|\*|(\^|~|>=|<=|>|<|=)?\s*v?\d+(\.\d+|(\.x|\.\*))?(\.\d+|(\.x|\.\*))?(-[a-zA-Z0-9-.]+)?(\+[a-zA-Z0-9-.]+)?(\s*(\s+|-|\|\|)\s*(\^|~|>=|<=|>|<|=)?\s*v?\d+(\.\d+|(\.x|\.\*))?(\.\d+|(\.x|\.\*))?(-[a-zA-Z0-9-.]+)?(\+[a-zA-Z0-9-.]+)?)*)$/;
  return SEMVER_SPEC_REGEX.test(trimmed);
}

// Common Lucide icon aliases for frequent AI naming mistakes / deprecated icons
export const LUCIDE_ICON_ALIASES = {
  Cart: "ShoppingCart",
  CartIcon: "ShoppingCart",
  ShoppingCartIcon: "ShoppingCart",
  Basket: "ShoppingBag",
  ShoppingBasket: "ShoppingBag",
  ShoppingBagIcon: "ShoppingBag",
  Bag: "ShoppingBag",
  Cross: "X",
  Close: "X",
  Cancel: "X",
  Tick: "Check",
  Checkmark: "Check",
  MagnifyingGlass: "Search",
  SearchIcon: "Search",
  TrashCan: "Trash2",
  Trash: "Trash2",
  Delete: "Trash2",
  Bin: "Trash2",
  Edit: "Pencil",
  Edit2: "Pencil",
  Edit3: "Pencil",
  PencilIcon: "Pencil",
  Hamburger: "Menu",
  NavMenu: "Menu",
  UserCircle2: "CircleUser",
  UserCircle: "CircleUser",
  Alert: "AlertTriangle",
  Warning: "AlertTriangle",
  Information: "Info",
  InfoCircle: "Info",
  Gear: "Settings",
  SettingsIcon: "Settings",
  HeartIcon: "Heart",
  StarIcon: "Star",
  Help: "HelpCircle",
  Question: "HelpCircle",
};

// Dynamically locate the lightweight AST parser (provided by rolldown/oxc)
let _parseAst = null;
let _parserLoaded = false;

// Dynamically locate Vite transformWithOxc compiler for real JSX compilation checks
let _transformWithOxc = null;
let _compilerLoaded = false;

// Dynamically locate installed Lucide React icon names
let _lucideIconsSet = null;
let _lucideLoaded = false;

// Dynamically locate Rolldown bundler for in-memory active-state runtime smoke tests
let _rolldown = null;
let _rolldownLoaded = false;

// Dynamically locate React and ReactDOMServer for active-state runtime verification
let _react = null;
let _reactDomServer = null;
let _jsxRuntime = null;
let _reactHarnessLoaded = false;

async function getRolldown() {
  if (_rolldownLoaded) return _rolldown;
  try {
    const candidates = [
      path.resolve(process.cwd(), "client/node_modules/rolldown/dist/index.mjs"),
      path.resolve(process.cwd(), "../client/node_modules/rolldown/dist/index.mjs"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/rolldown/dist/index.mjs"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const mod = await import(candidate);
        if (mod && mod.rolldown) {
          _rolldown = mod.rolldown;
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Validator] Note: rolldown bundler could not be loaded (${err.message}).`);
  }
  _rolldownLoaded = true;
  return _rolldown;
}

async function getReactHarness() {
  if (_reactHarnessLoaded) return { react: _react, reactDomServer: _reactDomServer, jsxRuntime: _jsxRuntime };
  try {
    const candidates = [
      {
        r: path.resolve(process.cwd(), "client/node_modules/react/index.js"),
        rds: path.resolve(process.cwd(), "client/node_modules/react-dom/server.node.js"),
        jsx: path.resolve(process.cwd(), "client/node_modules/react/jsx-runtime.js"),
      },
      {
        r: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/react/index.js"),
        rds: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/react-dom/server.node.js"),
        jsx: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/react/jsx-runtime.js"),
      },
    ];
    for (const c of candidates) {
      if (fs.existsSync(c.r) && fs.existsSync(c.rds)) {
        _react = (await import(c.r)).default;
        _reactDomServer = (await import(c.rds)).default;
        _jsxRuntime = await import(c.jsx);
        break;
      }
    }
  } catch (err) {
    console.warn(`[Validator] Note: React harness could not be loaded (${err.message}).`);
  }
  _reactHarnessLoaded = true;
  return { react: _react, reactDomServer: _reactDomServer, jsxRuntime: _jsxRuntime };
}

async function getParser() {
  if (_parserLoaded) return _parseAst;
  try {
    const candidates = [
      path.resolve(process.cwd(), "client/node_modules/rolldown/dist/parse-ast-index.mjs"),
      path.resolve(process.cwd(), "../client/node_modules/rolldown/dist/parse-ast-index.mjs"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/rolldown/dist/parse-ast-index.mjs"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const mod = await import(candidate);
        if (mod && mod.parseAst) {
          _parseAst = mod.parseAst;
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Validator] Note: AST parser could not be loaded (${err.message}). Using regex validation fallback.`);
  }
  _parserLoaded = true;
  return _parseAst;
}

async function getCompiler() {
  if (_compilerLoaded) return _transformWithOxc;
  try {
    const candidates = [
      path.resolve(process.cwd(), "client/node_modules/vite/dist/node/index.js"),
      path.resolve(process.cwd(), "../client/node_modules/vite/dist/node/index.js"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/vite/dist/node/index.js"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const mod = await import(candidate);
        if (mod && mod.transformWithOxc) {
          _transformWithOxc = mod.transformWithOxc;
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Validator] Note: Vite compiler could not be loaded (${err.message}).`);
  }
  _compilerLoaded = true;
  return _transformWithOxc;
}

async function getLucideIcons() {
  if (_lucideLoaded) return _lucideIconsSet;
  try {
    const candidates = [
      path.resolve(process.cwd(), "client/node_modules/lucide-react/dist/esm/lucide-react.mjs"),
      path.resolve(process.cwd(), "../client/node_modules/lucide-react/dist/esm/lucide-react.mjs"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/node_modules/lucide-react/dist/esm/lucide-react.mjs"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const mod = await import(candidate);
        if (mod) {
          _lucideIconsSet = new Set(Object.keys(mod));
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Validator] Note: Lucide icons could not be loaded (${err.message}).`);
  }

  if (!_lucideIconsSet) {
    _lucideIconsSet = new Set([
      "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ChevronRight", "ChevronLeft",
      "ChevronDown", "ChevronUp", "Check", "X", "Sparkles", "Star", "Heart", "Search",
      "Menu", "ShoppingCart", "ShoppingBag", "Plus", "Minus", "Trash2", "Pencil",
      "Eye", "EyeOff", "User", "CircleUser", "Settings", "Info", "AlertTriangle",
      "HelpCircle", "Filter", "SlidersHorizontal", "ExternalLink", "Share2", "Mail",
      "Phone", "MapPin", "Calendar", "Clock", "Shield", "Zap", "Sun", "Moon",
    ]);
  }
  _lucideLoaded = true;
  return _lucideIconsSet;
}

// Pre-load dependencies asynchronously at module initialization
const parserPromise = getParser();
const compilerPromise = getCompiler();
const lucidePromise = getLucideIcons();
const rolldownPromise = getRolldown();
const reactHarnessPromise = getReactHarness();
await Promise.all([parserPromise, compilerPromise, lucidePromise, rolldownPromise, reactHarnessPromise]);

/**
 * Checks if a named icon exists in the installed Lucide React package.
 */
export function isValidLucideIcon(iconName) {
  if (!_lucideIconsSet) {
    return true;
  }
  return _lucideIconsSet.has(iconName);
}

/**
 * Validates and repairs Lucide icon imports against installed package exports.
 */
export function validateAndFixLucideIcons(code, filePath, options = {}) {
  const warnings = [];
  const errors = [];
  const validIcons = _lucideIconsSet;

  const importRegex = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"];?/g;
  if (!importRegex.test(code)) {
    return { code, warnings, errors };
  }
  importRegex.lastIndex = 0;

  const replacements = [];

  let newCode = code.replace(importRegex, (match, specifiersBlock) => {
    const rawItems = specifiersBlock.split(",").map((s) => s.trim()).filter(Boolean);
    const newItems = [];

    for (const item of rawItems) {
      let iconName = item;
      let alias = "";
      if (item.includes(" as ")) {
        const parts = item.split(/\s+as\s+/);
        iconName = parts[0].trim();
        alias = parts[1].trim();
      }

      // 1. Direct match with valid icon export
      if (!validIcons || validIcons.has(iconName)) {
        newItems.push(item);
        continue;
      }

      // 2. Check canonical alias map
      if (LUCIDE_ICON_ALIASES[iconName] && (!validIcons || validIcons.has(LUCIDE_ICON_ALIASES[iconName]))) {
        const replacement = LUCIDE_ICON_ALIASES[iconName];
        warnings.push(`${filePath}: Replaced invalid/deprecated Lucide icon '${iconName}' with valid '${replacement}'`);
        if (alias) {
          newItems.push(`${replacement} as ${alias}`);
        } else {
          newItems.push(replacement);
          replacements.push({ from: iconName, to: replacement });
        }
        continue;
      }

      // 3. Case-insensitive match in valid icon set
      if (validIcons) {
        const lower = iconName.toLowerCase();
        const found = [...validIcons].find((v) => v.toLowerCase() === lower);
        if (found) {
          warnings.push(`${filePath}: Corrected Lucide icon casing '${iconName}' -> '${found}'`);
          if (alias) {
            newItems.push(`${found} as ${alias}`);
          } else {
            newItems.push(found);
            replacements.push({ from: iconName, to: found });
          }
          continue;
        }
      }

      // 4. Safe fallback if requested
      if (options.autoFallback) {
        warnings.push(`${filePath}: Unknown Lucide icon '${iconName}' safely replaced with fallback 'Sparkles'`);
        if (alias) {
          newItems.push(`Sparkles as ${alias}`);
        } else {
          newItems.push("Sparkles");
          replacements.push({ from: iconName, to: "Sparkles" });
        }
      } else {
        // Record structured error
        errors.push({
          type: "icon",
          file: filePath,
          message: `Invalid Lucide icon '${iconName}' imported in '${filePath}'. Icon does not exist in installed 'lucide-react'.`,
        });
        newItems.push(item);
      }
    }

    return `import { ${[...new Set(newItems)].join(", ")} } from 'lucide-react';`;
  });

  // Apply symbol replacements to component body
  for (const { from, to } of replacements) {
    const usageRegex = new RegExp(`\\b${from}\\b`, "g");
    newCode = newCode.replace(usageRegex, to);
  }

  return { code: newCode, warnings, errors };
}

/**
 * Runs real JSX/JS compilation check using Vite transformWithOxc.
 */
export async function compileModuleCode(code, filePath = "file.jsx") {
  const compiler = await compilerPromise;
  if (!compiler) {
    return { success: true, compiledCode: code, errors: [] };
  }
  try {
    // Ensure .jsx extension is used for React JSX files so Oxc enables JSX parsing mode
    const oxcFilePath = filePath.endsWith(".js") ? filePath.replace(/\.js$/, ".jsx") : filePath;
    const result = await compiler(code, oxcFilePath);
    return { success: true, compiledCode: result.code, errors: [] };
  } catch (err) {
    return {
      success: false,
      compiledCode: null,
      errors: [
        {
          type: "compilation",
          file: filePath,
          message: err.message || "JSX/JS compilation failed",
        },
      ],
    };
  }
}

/**
 * Parses JavaScript / JSX code into an AST.
 * Throws a syntax error with line/column/codeframe if syntax is invalid.
 */
export async function parseModuleAst(code, filePath = "file.jsx") {
  const parseFn = await parserPromise;
  if (!parseFn) {
    // Basic regex-based fallback if AST parser is not loaded
    return { type: "Program", body: [], fallback: true };
  }
  return parseFn(code, { lang: "jsx" }, filePath);
}

/**
 * Synchronous parser wrapper if parser is already loaded.
 */
function parseModuleAstSync(code, filePath = "file.jsx") {
  if (!_parseAst) return null;
  return _parseAst(code, { lang: "jsx" }, filePath);
}

/**
 * Validates and repairs common AI-generated code issues.
 * Returns structured validation result: { code, valid, errors, warnings, ast }
 */
export function validateAndFixCode(code, filePath, context = {}) {
  const warnings = [];
  const errors = [];
  const isCSS = filePath.endsWith(".css");
  const isJS = filePath.endsWith(".js") || filePath.endsWith(".jsx");

  // 1. Strip markdown code fences that some models wrap around code
  const fencePattern = /^```(?:jsx?|javascript|css|html|tsx?|react)?\s*\n([\s\S]*?)\n```\s*$/;
  const fenceMatch = code.match(fencePattern);
  if (fenceMatch) {
    code = fenceMatch[1];
    warnings.push(`${filePath}: Stripped markdown code fences`);
  }

  code = code.replace(/^```(?:jsx?|javascript|css|html|tsx?|react)?\s*\n/, "");
  code = code.replace(/\n```\s*$/, "");

  if (isCSS) {
    return {
      code: code.trim() + "\n",
      valid: true,
      errors: [],
      warnings,
      ast: null,
    };
  }

  if (!isJS) {
    return {
      code,
      valid: true,
      errors: [],
      warnings,
      ast: null,
    };
  }

  // --- Safe Pre-Normalization Repairs ---

  // 2. Fix class= -> className= in JSX tags
  const classFixRegex = /(<[a-zA-Z][^>]*?)\bclass=/g;
  if (classFixRegex.test(code)) {
    code = code.replace(/(<[a-zA-Z][^>]*?)\bclass=/g, "$1className=");
    warnings.push(`${filePath}: Fixed 'class=' -> 'className='`);
  }

  // 3. Fix for= -> htmlFor= in JSX labels
  const forFixRegex = /(<label[^>]*?)\bfor=/gi;
  if (forFixRegex.test(code)) {
    code = code.replace(/(<label[^>]*?)\bfor=/gi, "$1htmlFor=");
    warnings.push(`${filePath}: Fixed 'for=' -> 'htmlFor='`);
  }

  // 4. Self-close void elements that aren't self-closed
  for (const tag of VOID_ELEMENTS) {
    const voidRegex = new RegExp(`<${tag}(\\s[^>]*?)?(?<!/)>`, "gi");
    if (voidRegex.test(code)) {
      code = code.replace(new RegExp(`<${tag}(\\s[^>]*?)?(?<!/)>`, "gi"), (match, attrs) => `<${tag}${attrs || ""} />`);
      warnings.push(`${filePath}: Self-closed <${tag}> elements`);
    }
  }

  // 5. Remove stray HTML comments inside JSX return blocks
  const htmlCommentRegex = /<!--[\s\S]*?-->/g;
  if (htmlCommentRegex.test(code)) {
    code = code.replace(htmlCommentRegex, "");
    warnings.push(`${filePath}: Removed HTML comments (invalid in JSX)`);
  }

  // 6. Fix common TypeScript annotations
  code = code.replace(/:\s*React\.FC(?:<[^>]*>)?\s*=/g, () => {
    warnings.push(`${filePath}: Removed TypeScript React.FC annotation`);
    return " =";
  });

  code = code.replace(/(\([^)]*?)\s*:\s*(?:string|number|boolean|any|object|void)\s*([,)])/g, (match, before, after) => {
    warnings.push(`${filePath}: Removed TypeScript type annotation`);
    return `${before}${after}`;
  });

  // 6b. Fix accidental LLM syntax typo: mixing self-closing tags with arrow functions, e.g. (e) = /> fn(e)
  const brokenArrowRegex = /([a-zA-Z0-9_\)\]])\s*=\s*\/>/g;
  if (brokenArrowRegex.test(code)) {
    code = code.replace(brokenArrowRegex, "$1 =>");
    warnings.push(`${filePath}: Auto-corrected '= />' arrow function typo to '=>'`);
  }

  // 7. Ensure React import exists if JSX is used
  const hasJSX = /<[A-Za-z]/.test(code);
  const hasReactImport = /import\s+React\b/.test(code);
  if (hasJSX && !hasReactImport) {
    code = `import React from 'react';\n${code}`;
    warnings.push(`${filePath}: Added missing React import`);
  }

  // 8. Fix and validate relative import paths against planned/existing files
  if (context?.allPlannedFiles || context?.existingFiles) {
    const plannedList = context.allPlannedFiles || (context.existingFiles || []).map((p) => ({ path: p }));
    const fixResult = fixImportPaths(code, filePath, plannedList);
    code = fixResult.code;
    warnings.push(...fixResult.warnings);
  }

  // 8b. Validate and repair Lucide icon imports
  const iconResult = validateAndFixLucideIcons(code, filePath, {
    autoFallback: context?.autoFallbackIcons ?? false,
  });
  code = iconResult.code;
  warnings.push(...iconResult.warnings);
  errors.push(...iconResult.errors);

  // 8c. Defensive Prop & Configuration Hardening
  if (isJS) {
    // Provide safe defaults for common props in function parameters if not already assigned
    code = code.replace(
      /function\s+([A-Za-z0-9_]+)\s*\(\s*\{([^}]+)\}\s*\)/g,
      (match, funcName, propsBlock) => {
        const parts = propsBlock.split(",").map((p) => p.trim()).filter(Boolean);
        const updated = parts.map((part) => {
          if (part.includes("=")) return part;
          if (part === "storeConfig") {
            warnings.push(`${filePath}: Added defensive default for prop 'storeConfig' in '${funcName}'`);
            return 'storeConfig = (typeof STORE_CONFIG !== "undefined" ? STORE_CONFIG : {})';
          }
          if (part === "config") {
            warnings.push(`${filePath}: Added defensive default for prop 'config' in '${funcName}'`);
            return 'config = (typeof STORE_CONFIG !== "undefined" ? STORE_CONFIG : typeof config !== "undefined" ? config : {})';
          }
          if (part === "cart") {
            warnings.push(`${filePath}: Added defensive default 'cart = []' in '${funcName}'`);
            return "cart = []";
          }
          if (part === "products") {
            warnings.push(`${filePath}: Added defensive default 'products = []' in '${funcName}'`);
            return "products = []";
          }
          if (part === "categories") {
            warnings.push(`${filePath}: Added defensive default 'categories = []' in '${funcName}'`);
            return "categories = []";
          }
          if (part === "items") {
            warnings.push(`${filePath}: Added defensive default 'items = []' in '${funcName}'`);
            return "items = []";
          }
          if (part === "onClose") {
            warnings.push(`${filePath}: Added defensive default 'onClose = () => {}' in '${funcName}'`);
            return "onClose = () => {}";
          }
          return part;
        });
        return `function ${funcName}({ ${updated.join(", ")} })`;
      }
    );

    code = code.replace(
      /const\s+([A-Za-z0-9_]+)\s*=\s*\(\s*\{([^}]+)\}\s*\)\s*=>/g,
      (match, funcName, propsBlock) => {
        const parts = propsBlock.split(",").map((p) => p.trim()).filter(Boolean);
        const updated = parts.map((part) => {
          if (part.includes("=")) return part;
          if (part === "storeConfig") {
            warnings.push(`${filePath}: Added defensive default for prop 'storeConfig' in '${funcName}'`);
            return 'storeConfig = (typeof STORE_CONFIG !== "undefined" ? STORE_CONFIG : {})';
          }
          if (part === "config") {
            warnings.push(`${filePath}: Added defensive default for prop 'config' in '${funcName}'`);
            return 'config = (typeof STORE_CONFIG !== "undefined" ? STORE_CONFIG : typeof config !== "undefined" ? config : {})';
          }
          if (part === "cart") {
            warnings.push(`${filePath}: Added defensive default 'cart = []' in '${funcName}'`);
            return "cart = []";
          }
          if (part === "products") {
            warnings.push(`${filePath}: Added defensive default 'products = []' in '${funcName}'`);
            return "products = []";
          }
          if (part === "categories") {
            warnings.push(`${filePath}: Added defensive default 'categories = []' in '${funcName}'`);
            return "categories = []";
          }
          if (part === "items") {
            warnings.push(`${filePath}: Added defensive default 'items = []' in '${funcName}'`);
            return "items = []";
          }
          if (part === "onClose") {
            warnings.push(`${filePath}: Added defensive default 'onClose = () => {}' in '${funcName}'`);
            return "onClose = () => {}";
          }
          return part;
        });
        return `const ${funcName} = ({ ${updated.join(", ")} }) =>`;
      }
    );

    // Safe dereferencing for common nested configuration fields
    if (/\bstoreConfig\.freeShippingThreshold\b/.test(code)) {
      code = code.replace(/\bstoreConfig\.freeShippingThreshold\b/g, "(storeConfig?.freeShippingThreshold ?? 100)");
      warnings.push(`${filePath}: Hardened 'storeConfig.freeShippingThreshold' with optional chaining and fallback`);
    }
    if (/\bconfig\.freeShippingThreshold\b/.test(code)) {
      code = code.replace(/\bconfig\.freeShippingThreshold\b/g, "(config?.freeShippingThreshold ?? 100)");
      warnings.push(`${filePath}: Hardened 'config.freeShippingThreshold' with optional chaining and fallback`);
    }

    // Top-level STORE_CONFIG declaration if referenced but not defined
    if (
      (code.includes("storeConfig") || code.includes("STORE_CONFIG")) &&
      !code.includes("const STORE_CONFIG") &&
      !code.includes("let STORE_CONFIG") &&
      !code.includes("var STORE_CONFIG")
    ) {
      code = `const STORE_CONFIG = { freeShippingThreshold: 100, currency: "$", taxRate: 0.08 };\n${code}`;
      warnings.push(`${filePath}: Injected default fallback STORE_CONFIG declaration`);
    }
  }

  // 9. AST-based Syntax & Semantic Validation
  let ast = null;
  try {
    ast = parseModuleAstSync(code, filePath);
  } catch (parseErr) {
    errors.push({
      type: "syntax",
      file: filePath,
      message: parseErr.message || "Syntax error parsing JSX",
      pos: parseErr.pos,
      codeframe: parseErr.message,
    });
  }

  if (ast && ast.body) {
    // A. Verify and count default exports
    const defaultExports = ast.body.filter((n) => n.type === "ExportDefaultDeclaration");
    const namedExports = ast.body.filter((n) => n.type === "ExportNamedDeclaration");

    if (defaultExports.length > 1) {
      errors.push({
        type: "export",
        file: filePath,
        message: `Multiple default exports (${defaultExports.length}) found in '${filePath}'. React components must have exactly one default export.`,
      });
    } else if (defaultExports.length === 0) {
      // Attempt safe auto-repair: find top-level component function/const and export it
      const funcMatch = code.match(/^\s*function\s+([A-Z]\w*)\s*\(/m);
      const constMatch = code.match(/^\s*const\s+([A-Z]\w*)\s*=\s*(?:\(|function)/m);
      const componentName = funcMatch?.[1] || constMatch?.[1];

      if (componentName) {
        const namedExportRegex = new RegExp(`export\\s+(function|const)\\s+${componentName}`);
        if (namedExportRegex.test(code)) {
          code = code.replace(new RegExp(`export\\s+(function|const)\\s+${componentName}`), `export default $1 ${componentName}`);
        } else {
          code = code.trimEnd() + `\n\nexport default ${componentName};\n`;
        }
        warnings.push(`${filePath}: Added missing default export for '${componentName}'`);
      } else {
        errors.push({
          type: "export",
          file: filePath,
          message: `Component file '${filePath}' does not contain a default export.`,
        });
      }
    }

    // B. Verify imports (detect forbidden node builtins and unresolvable targets)
    const importNodes = ast.body.filter((n) => n.type === "ImportDeclaration");
    for (const imp of importNodes) {
      const source = imp.source?.value;
      if (!source) continue;

      if (!source.startsWith(".")) {
        // Package import: check forbidden Node.js or server-only packages
        const pkgName = source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : source.split("/")[0];
        if (FORBIDDEN_CLIENT_MODULES.has(pkgName) || FORBIDDEN_CLIENT_MODULES.has(source)) {
          errors.push({
            type: "dependency",
            file: filePath,
            message: `Unsupported server/Node.js module '${source}' imported in client component.`,
          });
        } else if (!SUPPORTED_PACKAGES.has(pkgName) && (!context?.declaredDependencies || !context.declaredDependencies[pkgName])) {
          errors.push({
            type: "dependency",
            file: filePath,
            message: `Unsupported package '${source}' imported in client component.`,
          });
        }
      } else if (context?.allPlannedFiles || context?.existingFiles) {
        // Relative import: verify target exists in planned/existing files
        const currentDir = getDir(filePath);
        const resolvedTarget = resolvePath(currentDir, source);
        const resolvedClean = cleanExtension(resolvedTarget);

        const availablePaths = [
          ...(context.allPlannedFiles || []).map((f) => (f.path.startsWith("/") ? f.path : "/" + f.path)),
          ...(context.existingFiles || []).map((p) => (p.startsWith("/") ? p : "/" + p)),
        ];

        const targetExists = availablePaths.some((p) => cleanExtension(p) === resolvedClean);
        if (!targetExists && availablePaths.length > 0) {
          errors.push({
            type: "import",
            file: filePath,
            message: `Unresolvable relative import '${source}' in '${filePath}'. Target file does not exist in planned files.`,
          });
        }
      }
    }
  } else if (!ast) {
    // Fallback export check if AST parser is inactive
    const defaultExportCount = (code.match(/export\s+default\s+/g) || []).length;
    if (defaultExportCount === 0) {
      const funcMatch = code.match(/^\s*function\s+([A-Z]\w*)\s*\(/m);
      const constMatch = code.match(/^\s*const\s+([A-Z]\w*)\s*=\s*(?:\(|function)/m);
      const componentName = funcMatch?.[1] || constMatch?.[1];

      if (componentName) {
        code = code.trimEnd() + `\n\nexport default ${componentName};\n`;
        warnings.push(`${filePath}: Added missing default export for '${componentName}'`);
      } else {
        errors.push({
          type: "export",
          file: filePath,
          message: `Missing default export in component file '${filePath}'`,
        });
      }
    } else if (defaultExportCount > 1) {
      errors.push({
        type: "export",
        file: filePath,
        message: `Multiple default exports found in '${filePath}'`,
      });
    }
  }

  return {
    code: code.trim() + "\n",
    valid: errors.length === 0,
    errors,
    warnings,
    ast,
  };
}

/**
 * Validates and fixes code for conversational revision operations.
 */
export function validateRevisionContent(content, filePath, op) {
  if (op === "delete") return { content, warnings: [], valid: true, errors: [] };

  if (op === "create") {
    const result = validateAndFixCode(content, filePath);
    return {
      content: result.code,
      warnings: result.warnings,
      valid: result.valid,
      errors: result.errors,
    };
  }

  // For update ops (search/replace), apply safe partial fixes
  const warnings = [];
  const errors = [];

  const classFixRegex = /(<[a-zA-Z][^>]*?)\bclass=/g;
  if (classFixRegex.test(content)) {
    content = content.replace(/(<[a-zA-Z][^>]*?)\bclass=/g, "$1className=");
    warnings.push(`${filePath}: Fixed 'class=' -> 'className=' in replacement`);
  }

  const forFixRegex = /(<label[^>]*?)\bfor=/gi;
  if (forFixRegex.test(content)) {
    content = content.replace(/(<label[^>]*?)\bfor=/gi, "$1htmlFor=");
    warnings.push(`${filePath}: Fixed 'for=' -> 'htmlFor=' in replacement`);
  }

  for (const tag of VOID_ELEMENTS) {
    const voidRegex = new RegExp(`<${tag}(\\s[^>]*?)?(?<!/)>`, "gi");
    if (voidRegex.test(content)) {
      content = content.replace(new RegExp(`<${tag}(\\s[^>]*?)?(?<!/)>`, "gi"), (match, attrs) => `<${tag}${attrs || ""} />`);
      warnings.push(`${filePath}: Self-closed <${tag}> in replacement`);
    }
  }

  return { content, warnings, valid: true, errors };
}

/**
 * Validates an entire multi-file project for cross-file integrity,
 * missing components, import contracts, and entry point completeness.
 */
export function validateProject(files, plannedFiles = []) {
  const errors = [];
  const warnings = [];

  if (!files || typeof files !== "object") {
    return {
      valid: false,
      errors: [{ type: "missing_file", file: "/", message: "Project files object is empty or invalid" }],
      warnings: [],
    };
  }

  const filePaths = Object.keys(files);

  // 1. Mandatory Entry Point /App.js
  if (!files["/App.js"]) {
    errors.push({
      type: "missing_file",
      file: "/App.js",
      message: "Project is missing required entry point '/App.js'",
    });
  }

  // 2. Recommended Global CSS /styles.css
  if (!files["/styles.css"]) {
    warnings.push("Project is missing '/styles.css' stylesheet");
  }

  // 3. Verify planned files exist
  if (Array.isArray(plannedFiles)) {
    for (const planned of plannedFiles) {
      const rawPath = typeof planned === 'string' ? planned : planned?.path || '';
      if (!rawPath) continue;
      const pPath = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
      if (!files[pPath]) {
        errors.push({
          type: "missing_file",
          file: pPath,
          message: `Planned file '${pPath}' was not generated.`,
        });
      }
    }
  }

  // 4. Validate each file individually
  const fileExports = new Map();

  // Extract declaredDependencies from package.json if present for context
  let declaredDependencies = null;
  const pkgContent = files["/package.json"] || files["package.json"];
  if (pkgContent) {
    try {
      const raw = typeof pkgContent === "string" ? pkgContent : pkgContent?.content || "";
      const p = JSON.parse(raw);
      if (p.dependencies && typeof p.dependencies === "object") {
        declaredDependencies = p.dependencies;
      }
    } catch {}
  }

  for (const [filePath, fileData] of Object.entries(files)) {
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    const result = validateAndFixCode(content, filePath, {
      allPlannedFiles: plannedFiles,
      existingFiles: filePaths,
      declaredDependencies,
    });

    if (!result.valid) {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);

    // Track exports for contract verification
    if (result.ast && result.ast.body) {
      const defaultExport = result.ast.body.find((n) => n.type === "ExportDefaultDeclaration");
      const namedExports = result.ast.body
        .filter((n) => n.type === "ExportNamedDeclaration")
        .map((n) => n.declaration?.id?.name || n.declaration?.declarations?.[0]?.id?.name)
        .filter(Boolean);

      fileExports.set(filePath, {
        hasDefault: Boolean(defaultExport),
        named: new Set(namedExports),
      });
    }
  }

  // 5. Cross-file component contracts
  for (const [filePath, fileData] of Object.entries(files)) {
    if (!filePath.endsWith(".js") && !filePath.endsWith(".jsx")) continue;
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    const currentDir = getDir(filePath);

    let ast = null;
    try {
      ast = parseModuleAstSync(content, filePath);
    } catch {
      // Syntax error already captured above
    }

    if (ast && ast.body) {
      const imports = ast.body.filter((n) => n.type === "ImportDeclaration");
      for (const imp of imports) {
        const source = imp.source?.value;
        if (!source || !source.startsWith(".")) continue;

        const resolved = resolvePath(currentDir, source);
        const resolvedPath = filePaths.find((p) => cleanExtension(p) === cleanExtension(resolved));

        if (!resolvedPath) {
          const wasPlanned = plannedFiles.some((p) => cleanExtension(p.path) === cleanExtension(resolved));
          if (wasPlanned) {
            errors.push({
              type: "import",
              file: filePath,
              message: `File '${filePath}' imports '${source}', but this planned target was never generated.`,
            });
          } else {
            errors.push({
              type: "import",
              file: filePath,
              message: `Unresolvable import '${source}' in '${filePath}'. Target file does not exist.`,
            });
          }
          continue;
        }

        if (fileExports.has(resolvedPath)) {
          const targetExports = fileExports.get(resolvedPath);
          for (const spec of imp.specifiers || []) {
            if (spec.type === "ImportDefaultSpecifier" && !targetExports.hasDefault) {
              errors.push({
                type: "contract",
                file: filePath,
                message: `File '${filePath}' imports default from '${source}', but '${resolvedPath}' has no default export.`,
              });
            } else if (spec.type === "ImportSpecifier") {
              const importedName = spec.imported?.name || spec.local?.name;
              if (importedName && !targetExports.named.has(importedName)) {
                errors.push({
                  type: "contract",
                  file: filePath,
                  message: `File '${filePath}' imports '{ ${importedName} }' from '${source}', but '${resolvedPath}' does not export '${importedName}'.`,
                });
              }
            }
          }
        }
      }
    }
  }

  // 6. AST Component Prop Contract Validation
  const propContracts = validatePropContracts(files);
  errors.push(...propContracts.errors);
  warnings.push(...propContracts.warnings);

  // 7. Dependency Preflight Validation & /package.json synthesis
  const depValidation = validateProjectDependencies(files);
  errors.push(...depValidation.errors);
  warnings.push(...depValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Project Dependency Preflight & package.json synthesis
 * Validates external npm package imports against forbidden Node built-ins,
 * verifies npm package naming rules, validates semver versions in package.json,
 * detects undeclared dependencies, and auto-synthesizes/normalizes canonical package.json.
 */
export function validateProjectDependencies(files) {
  const errors = [];
  const warnings = [];

  if (!files || typeof files !== "object") {
    return { errors, warnings };
  }

  // 1. Gather external imports across all JS/JSX files
  const importedPackages = new Map(); // pkgName -> Set<filePath>

  for (const [filePath, fileData] of Object.entries(files)) {
    if (!filePath.endsWith(".js") && !filePath.endsWith(".jsx")) continue;
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    if (!content.trim()) continue;

    let ast = null;
    try {
      ast = parseModuleAstSync(content, filePath);
    } catch {
      // AST unavailable; regex fallback below
    }

    if (ast && ast.body) {
      for (const node of ast.body) {
        if (node.type === "ImportDeclaration" && node.source?.value) {
          const source = node.source.value.trim();
          if (!source.startsWith(".") && !source.startsWith("/")) {
            const pkgName = source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : source.split("/")[0];
            if (!importedPackages.has(pkgName)) {
              importedPackages.set(pkgName, new Set());
            }
            importedPackages.get(pkgName).add(filePath);
          }
        }
      }
    } else {
      // Regex fallback: strip comments and template literals to avoid false positives on mock code
      const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "")
        .replace(/`[\s\S]*?`/g, "");
      const importRegex = /(?:import\s+(?:(?:\*\s+as\s+[\w$]+|(?:\{[\s\S]*?\}|[\w$]+)(?:\s*,\s*(?:\{[\s\S]*?\}|[\w$]+))*)\s+from\s+)?|import\()\s*['"]([^./][^'"]*)['"]/g;
      let match;
      while ((match = importRegex.exec(stripped)) !== null) {
        const source = match[1].trim();
        const pkgName = source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : source.split("/")[0];
        if (!importedPackages.has(pkgName)) {
          importedPackages.set(pkgName, new Set());
        }
        importedPackages.get(pkgName).add(filePath);
      }
    }
  }

  // 2. Locate or synthesize canonical /package.json
  const pkgKey = files["/package.json"] !== undefined ? "/package.json" : (files["package.json"] !== undefined ? "package.json" : null);
  let parsedPkg = null;
  let pkgIsObject = false;

  if (pkgKey) {
    pkgIsObject = typeof files[pkgKey] === "object" && files[pkgKey] !== null;
    const rawText = pkgIsObject ? files[pkgKey].content || "" : files[pkgKey] || "";
    try {
      parsedPkg = JSON.parse(rawText);
    } catch (err) {
      errors.push({
        type: "dependency_invalid_syntax",
        file: pkgKey,
        message: `Malformed ${pkgKey}: ${err.message}`,
      });
    }
  }

  const setPkgJson = (obj) => {
    const formatted = JSON.stringify(obj, null, 2);
    if (pkgKey) {
      if (pkgIsObject) {
        files[pkgKey].content = formatted;
      } else {
        files[pkgKey] = formatted;
      }
    } else {
      files["/package.json"] = formatted;
    }
  };

  // If no package.json exists or it wasn't parsed (and no JSON syntax error), synthesize it
  if (!pkgKey) {
    const defaultDeps = {
      react: DEFAULT_PACKAGE_VERSIONS.react,
      "react-dom": DEFAULT_PACKAGE_VERSIONS["react-dom"],
    };

    for (const pkg of importedPackages.keys()) {
      if (isValidNpmPackageName(pkg) && !FORBIDDEN_CLIENT_MODULES.has(pkg)) {
        defaultDeps[pkg] = DEFAULT_PACKAGE_VERSIONS[pkg] || "^1.0.0";
      }
    }

    parsedPkg = {
      name: "builder-ai-project",
      version: "1.0.0",
      private: true,
      dependencies: defaultDeps,
    };

    setPkgJson(parsedPkg);
    warnings.push("Auto-synthesized canonical /package.json with verified pinned dependencies.");
  }

  // 3. Validate declared dependencies in package.json
  const activePkgKey = pkgKey || "/package.json";
  if (parsedPkg) {
    if (!parsedPkg.dependencies || typeof parsedPkg.dependencies !== "object") {
      parsedPkg.dependencies = {};
    }

    let pkgModified = false;

    // Check mandatory react and react-dom
    if (!parsedPkg.dependencies.react) {
      parsedPkg.dependencies.react = DEFAULT_PACKAGE_VERSIONS.react;
      pkgModified = true;
    }
    if (!parsedPkg.dependencies["react-dom"]) {
      parsedPkg.dependencies["react-dom"] = DEFAULT_PACKAGE_VERSIONS["react-dom"];
      pkgModified = true;
    }

    for (const [pkgName, version] of Object.entries(parsedPkg.dependencies)) {
      if (FORBIDDEN_CLIENT_MODULES.has(pkgName)) {
        errors.push({
          type: "dependency_forbidden",
          file: activePkgKey,
          message: `Forbidden server/Node.js module '${pkgName}' declared in ${activePkgKey}.`,
        });
      } else if (!isValidNpmPackageName(pkgName)) {
        errors.push({
          type: "dependency_invalid_name",
          file: activePkgKey,
          message: `Invalid npm package name '${pkgName}' in ${activePkgKey}.`,
        });
      }

      if (!isValidSemverSpec(version)) {
        errors.push({
          type: "dependency_invalid_version",
          file: activePkgKey,
          message: `Invalid version specification '${version}' for package '${pkgName}' in ${activePkgKey}.`,
        });
      }

      // Auto-normalize "latest" to pinned version when available
      if (version === "latest" && DEFAULT_PACKAGE_VERSIONS[pkgName]) {
        parsedPkg.dependencies[pkgName] = DEFAULT_PACKAGE_VERSIONS[pkgName];
        pkgModified = true;
        warnings.push(`Normalized '${pkgName}' version from 'latest' to pinned '${DEFAULT_PACKAGE_VERSIONS[pkgName]}' in ${activePkgKey}.`);
      }
    }

    // 4. Verify all imported packages against declared dependencies
    for (const [pkgName, filePathsSet] of importedPackages.entries()) {
      const firstFile = Array.from(filePathsSet)[0];

      if (FORBIDDEN_CLIENT_MODULES.has(pkgName)) {
        errors.push({
          type: "dependency_forbidden",
          file: firstFile,
          message: `Unsupported server/Node.js module '${pkgName}' imported in '${firstFile}'.`,
        });
      } else if (!isValidNpmPackageName(pkgName)) {
        errors.push({
          type: "dependency_invalid_name",
          file: firstFile,
          message: `Invalid npm package name '${pkgName}' imported in '${firstFile}'.`,
        });
      } else if (!parsedPkg.dependencies[pkgName] && !SUPPORTED_PACKAGES.has(pkgName)) {
        errors.push({
          type: "dependency_undeclared",
          file: firstFile,
          message: `Undeclared external dependency '${pkgName}' imported in '${firstFile}'. Add it to package.json dependencies or use a supported package.`,
        });
      } else if (!parsedPkg.dependencies[pkgName] && SUPPORTED_PACKAGES.has(pkgName)) {
        parsedPkg.dependencies[pkgName] = DEFAULT_PACKAGE_VERSIONS[pkgName] || "^1.0.0";
        pkgModified = true;
        warnings.push(`Auto-added supported package '${pkgName}' (${parsedPkg.dependencies[pkgName]}) to ${activePkgKey}.`);
      }
    }

    if (pkgModified) {
      setPkgJson(parsedPkg);
    }
  }

  return { errors, warnings };
}

/**
 * AST-based Component Prop Contract Validation
 * Verifies that callers (e.g. /App.js) pass all required props expected by child components,
 * and detects mismatched prop names (e.g. passing 'config' when child expects 'storeConfig').
 */
export function validatePropContracts(files) {
  const errors = [];
  const warnings = [];

  if (!files || typeof files !== "object") {
    return { errors, warnings };
  }

  function walkAst(node, visitor) {
    if (!node || typeof node !== "object") return;
    visitor(node);
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) walkAst(c, visitor);
      } else if (child && typeof child === "object") {
        walkAst(child, visitor);
      }
    }
  }

  // 1. Extract component prop requirements from each component file
  const componentMap = new Map();

  for (const [filePath, fileData] of Object.entries(files)) {
    if (!filePath.endsWith(".js") && !filePath.endsWith(".jsx")) continue;
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    let ast = null;
    try {
      ast = parseModuleAstSync(content, filePath);
    } catch {
      continue;
    }
    if (!ast || !ast.body) continue;

    for (const node of ast.body) {
      let func = null;
      let compName = "";

      if (node.type === "ExportDefaultDeclaration") {
        if (node.declaration?.type === "FunctionDeclaration") {
          func = node.declaration;
          compName = func.id?.name || filePath.split("/").pop().replace(/\.(js|jsx)$/, "");
        } else if (node.declaration?.type === "Identifier") {
          const idName = node.declaration.name;
          compName = idName;
          const decl = ast.body.find(
            (b) =>
              (b.type === "FunctionDeclaration" && b.id?.name === idName) ||
              (b.type === "VariableDeclaration" && b.declarations?.some((d) => d.id?.name === idName))
          );
          if (decl?.type === "FunctionDeclaration") func = decl;
          else if (decl?.type === "VariableDeclaration") {
            const d = decl.declarations.find((d) => d.id?.name === idName);
            func = d?.init;
          }
        } else if (
          node.declaration?.type === "ArrowFunctionExpression" ||
          node.declaration?.type === "FunctionExpression"
        ) {
          func = node.declaration;
          compName = filePath.split("/").pop().replace(/\.(js|jsx)$/, "");
        }
      } else if (node.type === "ExportNamedDeclaration" && node.declaration) {
        if (node.declaration.type === "FunctionDeclaration") {
          func = node.declaration;
          compName = func.id?.name || "";
        } else if (node.declaration.type === "VariableDeclaration") {
          const d = node.declaration.declarations?.[0];
          if (d && (d.init?.type === "ArrowFunctionExpression" || d.init?.type === "FunctionExpression")) {
            func = d.init;
            compName = d.id?.name || "";
          }
        }
      }

      if (func && (func.type === "FunctionDeclaration" || func.type === "ArrowFunctionExpression" || func.type === "FunctionExpression")) {
        const firstParam = func.params?.[0];
        if (firstParam && firstParam.type === "ObjectPattern") {
          const requiredProps = new Set();
          const propDefaults = new Set();
          const allProps = new Set();

          for (const prop of firstParam.properties || []) {
            if (prop.type === "Property" && prop.key?.name) {
              const name = prop.key.name;
              allProps.add(name);
              if (prop.value?.type === "AssignmentPattern") {
                propDefaults.add(name);
              }
            }
          }

          // Walk function body to detect dereferenced props without default fallback
          walkAst(func.body, (n) => {
            if (n.type === "MemberExpression" && n.object?.type === "Identifier") {
              const objName = n.object.name;
              if (allProps.has(objName) && !propDefaults.has(objName) && !n.optional) {
                requiredProps.add(objName);
              }
            } else if (n.type === "VariableDeclarator" && n.id?.type === "ObjectPattern" && n.init?.type === "Identifier") {
              const objName = n.init.name;
              if (allProps.has(objName) && !propDefaults.has(objName)) {
                requiredProps.add(objName);
              }
            }
          });

          if (compName) {
            componentMap.set(compName, {
              filePath,
              componentName: compName,
              requiredProps,
              propDefaults,
              allProps,
            });
          }
        }
      }
    }
  }

  // Known prop aliases / mismatches
  const propAliases = {
    storeConfig: ["config", "settings", "storeSettings", "options"],
    config: ["storeConfig", "settings", "options"],
    cart: ["cartItems", "items", "basket"],
    products: ["items", "productList", "goods"],
    categories: ["categoryList", "cats"],
    isOpen: ["open", "show", "visible", "isCartOpen", "isModalOpen"],
    onClose: ["close", "handleClose", "onDismiss"],
  };

  // 2. Scan JSX invocations across all files
  for (const [filePath, fileData] of Object.entries(files)) {
    if (!filePath.endsWith(".js") && !filePath.endsWith(".jsx")) continue;
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    let ast = null;
    try {
      ast = parseModuleAstSync(content, filePath);
    } catch {
      continue;
    }
    if (!ast || !ast.body) continue;

    const importedComponents = new Map();
    for (const node of ast.body) {
      if (node.type === "ImportDeclaration" && node.source?.value?.startsWith(".")) {
        const importSource = node.source.value;
        const currentDir = getDir(filePath);
        const resolved = resolvePath(currentDir, importSource);
        for (const spec of node.specifiers || []) {
          const localName = spec.local?.name;
          if (localName) {
            importedComponents.set(localName, resolved);
          }
        }
      }
    }

    walkAst(ast, (n) => {
      if (n.type === "JSXOpeningElement" && n.name?.type === "JSXIdentifier") {
        const tagName = n.name.name;
        let matchedComp = componentMap.get(tagName);
        if (!matchedComp && importedComponents.has(tagName)) {
          const targetPath = importedComponents.get(tagName);
          matchedComp = [...componentMap.values()].find(
            (c) => cleanExtension(c.filePath) === cleanExtension(targetPath)
          );
        }

        if (matchedComp && matchedComp.filePath !== filePath) {
          const passedAttrs = new Set();
          let hasSpread = false;

          for (const attr of n.attributes || []) {
            if (attr.type === "JSXAttribute" && attr.name?.name) {
              passedAttrs.add(attr.name.name);
            } else if (attr.type === "JSXSpreadAttribute") {
              hasSpread = true;
            }
          }

          if (!hasSpread) {
            for (const requiredProp of matchedComp.requiredProps) {
              if (!passedAttrs.has(requiredProp)) {
                const aliases = propAliases[requiredProp] || [];
                const passedMismatch = aliases.find((a) => passedAttrs.has(a));

                if (passedMismatch) {
                  errors.push({
                    type: "prop_contract_mismatch",
                    file: filePath,
                    targetFile: matchedComp.filePath,
                    component: tagName,
                    prop: requiredProp,
                    message: `Component '<${tagName} />' in '${filePath}' passes mismatched prop '${passedMismatch}' instead of '${requiredProp}' expected by '${matchedComp.filePath}'.`,
                  });
                } else {
                  errors.push({
                    type: "prop_contract_mismatch",
                    file: filePath,
                    targetFile: matchedComp.filePath,
                    component: tagName,
                    prop: requiredProp,
                    message: `Component '<${tagName} />' in '${filePath}' is missing required prop '${requiredProp}' expected by '${matchedComp.filePath}'.`,
                  });
                }
              }
            }
          }
        }
      }
    });
  }

  return { errors, warnings };
}

/**
 * In-memory active-state runtime verification harness.
 * Compiles and executes project files in Node.js, mounting <App /> and
 * rendering modal/drawer components with active state { isOpen: true }.
 * Catches runtime TypeErrors before project generation is marked as completed.
 */
export async function verifyProjectRuntime(files) {
  const errors = [];

  if (!files || typeof files !== "object" || !files["/App.js"]) {
    return { valid: true, errors };
  }

  const rolldownFn = await getRolldown();
  const harness = await getReactHarness();

  if (!rolldownFn || !harness.react || !harness.reactDomServer) {
    return { valid: true, errors };
  }

  // Normalize files with .jsx extension for Rolldown OXC JSX parsing
  const normalized = {};
  for (const [p, c] of Object.entries(files)) {
    const key = (p.startsWith("/") ? p : "/" + p).replace(/\.js$/, ".jsx");
    normalized[key] = typeof c === "string" ? c : c.content || "";
  }

  // Find components in /components/
  const componentPaths = Object.keys(normalized).filter(
    (k) => k.includes("/components/") && k.endsWith(".jsx")
  );

  let entryImports = `import React from "react";\nimport App from "/App.jsx";\n`;
  let entryMounts = `
export function runSmoke() {
  const results = [];
  results.push({ name: "/App.js", element: React.createElement(App) });
`;

  componentPaths.forEach((cp, idx) => {
    const compName = "SmokeComp" + idx;
    const jsPath = cp.replace(/\.jsx$/, ".js");
    const originalName = files[jsPath] ? jsPath : cp;
    entryImports += `import ${compName} from "${cp}";\n`;
    entryMounts += `  try {\n    results.push({ name: "${originalName}", element: React.createElement(${compName}, { isOpen: true, active: true, show: true }) });\n  } catch (e) { results.push({ name: "${originalName}", initError: e.message }); }\n`;
  });

  entryMounts += `  return results;\n}\n`;

  const entryCode = entryImports + entryMounts;
  normalized["/smoke_test_entry.jsx"] = entryCode;

  try {
    const build = await rolldownFn({
      input: "/smoke_test_entry.jsx",
      plugins: [
        {
          name: "virtual-smoke-harness",
          resolveId(id, importer) {
            if (id.endsWith(".css")) {
              return { id, external: true };
            }
            if (id.startsWith(".") || id.startsWith("/")) {
              const resolved = resolveVirtualPath(importer, id).replace(/\.js$/, ".jsx");
              if (normalized[resolved]) return resolved;
              if (normalized[resolved + ".jsx"]) return resolved + ".jsx";
              return resolved;
            }
            return { id, external: true };
          },
          load(id) {
            return normalized[id] || null;
          },
        },
      ],
      logLevel: "silent",
    });

    const res = await build.generate({ format: "cjs" });
    const bundledCode = res.output[0].code;

    const lucideProxy = new Proxy(
      {},
      {
        get: (_, iconName) => (props) =>
          harness.react.createElement("svg", { "data-icon": iconName, ...props }),
      }
    );

    const customRequire = (id) => {
      if (id === "react") return harness.react;
      if (id === "react/jsx-runtime") return harness.jsxRuntime;
      if (id === "lucide-react") return lucideProxy;
      if (id === "canvas-confetti") return () => {};
      if (id.endsWith(".css")) return {};
      return {};
    };

    const mockWindow = {
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener: () => {},
      removeEventListener: () => {},
      scrollTo: () => {},
      location: { href: "http://localhost/" },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    };

    const m = { exports: {} };
    const fn = new Function("require", "module", "exports", "window", "document", bundledCode);
    fn(customRequire, m, m.exports, mockWindow, {});

    const tests = m.exports.runSmoke();
    for (const t of tests) {
      if (t.initError) {
        errors.push({
          type: "runtime_exception",
          file: t.name,
          message: `Runtime instantiation error in '${t.name}': ${t.initError}`,
        });
        continue;
      }
      try {
        harness.reactDomServer.renderToString(t.element);
      } catch (err) {
        errors.push({
          type: "runtime_exception",
          file: t.name,
          message: `Runtime render error in '${t.name}': ${err.message}`,
        });
      }
    }
  } catch (bundlerErr) {
    errors.push({
      type: "runtime_exception",
      file: "/App.js",
      message: `Active-state runtime bundler error: ${bundlerErr.message}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function resolveVirtualPath(importer, target) {
  if (target.startsWith("/")) return target;
  const importerDir = importer ? importer.split("/").slice(0, -1).join("/") || "/" : "/";
  const parts = (importerDir + "/" + target).split("/").filter(Boolean);
  const stack = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return "/" + stack.join("/");
}

// --- Import Path Resolution Helpers ---

function getDir(p) {
  const parts = p.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

function resolvePath(baseDir, relativePath) {
  const baseParts = baseDir.split("/").filter(Boolean);
  const relParts = relativePath.split("/").filter(Boolean);

  for (const part of relParts) {
    if (part === ".") {
      continue;
    } else if (part === "..") {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  return "/" + baseParts.join("/");
}

function getRelativePath(fromDir, toPath) {
  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = toPath.split("/").filter(Boolean);

  let commonLength = 0;
  while (commonLength < fromParts.length && commonLength < toParts.length && fromParts[commonLength] === toParts[commonLength]) {
    commonLength++;
  }

  const upCount = fromParts.length - commonLength;
  const remainingTo = toParts.slice(commonLength);

  const relParts = [];
  for (let i = 0; i < upCount; i++) {
    relParts.push("..");
  }
  if (relParts.length === 0) {
    relParts.push(".");
  }
  relParts.push(...remainingTo);
  return relParts.join("/");
}

function cleanExtension(p) {
  return p.replace(/\.(js|jsx|css|ts|tsx)$/, "");
}

function fixImportPaths(code, filePath, allPlannedFiles) {
  const warnings = [];
  if (!allPlannedFiles || allPlannedFiles.length === 0) {
    return { code, warnings };
  }

  const currentDir = getDir(filePath);
  const plannedPaths = allPlannedFiles.map((f) => (f.path.startsWith("/") ? f.path : "/" + f.path));

  const importRegex = /(from\s+['"]|import\s+['"])([^'"]+)(['"])/g;

  const newCode = code.replace(importRegex, (match, prefix, importTarget, suffix) => {
    if (!importTarget.startsWith(".")) {
      return match;
    }

    const resolvedTarget = resolvePath(currentDir, importTarget);
    const resolvedClean = cleanExtension(resolvedTarget);

    const exactExists = plannedPaths.some((p) => cleanExtension(p) === resolvedClean);
    if (exactExists) {
      return match;
    }

    const importFilename = resolvedClean.split("/").pop();
    if (!importFilename) {
      return match;
    }

    const foundPlannedPath = plannedPaths.find((p) => {
      const plannedClean = cleanExtension(p);
      const plannedFilename = plannedClean.split("/").pop();
      return plannedFilename === importFilename;
    });

    if (foundPlannedPath) {
      const newRelative = getRelativePath(currentDir, foundPlannedPath);
      const finalRelative = newRelative.startsWith(".") ? newRelative : "./" + newRelative;

      const hasExt = /\.(js|jsx|css|ts|tsx)$/.test(importTarget);
      const ext = hasExt ? "." + importTarget.split(".").pop() : "";

      const rewrittenTarget = cleanExtension(finalRelative) + ext;
      if (rewrittenTarget !== importTarget) {
        warnings.push(
          `${filePath}: Corrected import '${importTarget}' to '${rewrittenTarget}' (file planned at '${foundPlannedPath}')`,
        );
        return `${prefix}${rewrittenTarget}${suffix}`;
      }
    }

    return match;
  });

  return { code: newCode, warnings };
}
