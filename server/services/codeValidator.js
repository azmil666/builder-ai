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

// Node.js built-in modules and server-only packages that break in browser/Sandpack
const FORBIDDEN_CLIENT_MODULES = new Set([
  "fs", "node:fs", "path", "node:path", "child_process", "node:child_process",
  "os", "node:os", "crypto", "node:crypto", "http", "node:http",
  "https", "node:https", "net", "node:net", "dns", "node:dns",
  "stream", "node:stream", "buffer", "node:buffer", "process", "node:process",
  "express", "mongoose", "dotenv", "bcrypt", "jsonwebtoken",
  "@ai-sdk/openai", "ai"
]);

// Explicitly supported browser packages for Sandpack preview
const SUPPORTED_PACKAGES = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "lucide-react",
  "canvas-confetti",
  "framer-motion",
  "date-fns",
  "moment",
  "lodash",
  "lodash-es",
  "clsx",
  "tailwind-merge",
  "zustand",
  "recharts",
  "axios",
]);

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

  const importRegex = /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"];?/g;
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
        } else if (!SUPPORTED_PACKAGES.has(pkgName)) {
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
      const pPath = planned.path.startsWith("/") ? planned.path : "/" + planned.path;
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

  for (const [filePath, fileData] of Object.entries(files)) {
    const content = typeof fileData === "string" ? fileData : fileData?.content || "";
    const result = validateAndFixCode(content, filePath, {
      allPlannedFiles: plannedFiles,
      existingFiles: filePaths,
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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
