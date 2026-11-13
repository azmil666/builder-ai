import { resolveProjectFramework, getDefaultActiveFile } from "./frameworkUtils.js";

// Standard verified, compatible versions pre-cached on CodeSandbox packager CDN
export const DEFAULT_PACKAGE_VERSIONS = {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "lucide-react": "^0.469.0",
  "canvas-confetti": "^1.9.3",
  "framer-motion": "^11.15.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "date-fns": "^3.6.0",
  "lodash": "^4.17.21",
  "lodash-es": "^4.17.21",
  "recharts": "^2.15.0",
  "zustand": "^4.5.5",
  "axios": "^1.7.9",
  "prismjs": "^1.29.0",
};

// Forbidden Node.js built-ins and server-only modules that cannot resolve in Sandpack
export const FORBIDDEN_CLIENT_MODULES = new Set([
  "fs", "node:fs", "path", "node:path", "child_process", "node:child_process",
  "os", "node:os", "crypto", "node:crypto", "http", "node:http",
  "https", "node:https", "net", "node:net", "dns", "node:dns",
  "stream", "node:stream", "buffer", "node:buffer", "process", "node:process",
  "express", "mongoose", "dotenv", "bcrypt", "jsonwebtoken",
  "@ai-sdk/openai", "ai",
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
 * Extracts and normalizes external npm dependencies required by project files.
 * Handles both string code and object { content } formats.
 * For vanilla HTML/CSS/JS projects, returns an empty dependency map.
 */
export function detectDependencies(files, options = {}) {
  // If explicitly vanilla framework, return empty dependencies
  if (options.framework === "vanilla") {
    return {};
  }

  const deps = {};
  if (!files || typeof files !== "object") {
    return {
      react: DEFAULT_PACKAGE_VERSIONS.react,
      "react-dom": DEFAULT_PACKAGE_VERSIONS["react-dom"],
    };
  }

  const filePaths = Object.keys(files);

  // 1. Check if a canonical /package.json exists in the project
  const pkgJsonContent = files["/package.json"] || files["package.json"];
  if (pkgJsonContent) {
    try {
      const rawText = typeof pkgJsonContent === "string" ? pkgJsonContent : pkgJsonContent?.content || "";
      const parsed = JSON.parse(rawText);
      if (parsed.dependencies && typeof parsed.dependencies === "object") {
        for (const [name, version] of Object.entries(parsed.dependencies)) {
          if (isValidNpmPackageName(name) && !FORBIDDEN_CLIENT_MODULES.has(name)) {
            deps[name] = version;
          }
        }
      }
    } catch {
      // Fall through to AST/statement scanning if package.json is malformed
    }
  }

  // 2. Scan source code for actual top-level ES module imports
  for (const [filePath, fileData] of Object.entries(files)) {
    if (!filePath.endsWith(".js") && !filePath.endsWith(".jsx")) continue;
    const rawCode = typeof fileData === "string" ? fileData : fileData?.content || "";
    if (!rawCode) continue;

    // Strip comments and multiline template literals to prevent capturing mock code in strings
    const cleanCode = rawCode
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/`[\s\S]*?`/g, '""');

    // Matches valid ES module import statements
    const importRegex = /(?:^|[\n;])\s*import\s+(?:(?:(?:\*\s+as\s+[\w$]+|[\w$]+|{[^}]*})\s+from\s+)|)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(cleanCode)) !== null) {
      const importTarget = match[1].trim();

      // Skip relative, absolute, alias, and asset imports
      if (
        importTarget.startsWith(".") ||
        importTarget.startsWith("/") ||
        importTarget.startsWith("@/") ||
        /\.(css|svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|json)$/i.test(importTarget)
      ) {
        continue;
      }

      // Extract package identifier (scoped or unscoped)
      const pkg = importTarget.startsWith("@")
        ? importTarget.split("/").slice(0, 2).join("/")
        : importTarget.split("/")[0];

      // Skip react and react-dom (handled explicitly with compatible versions)
      if (pkg === "react" || pkg === "react-dom") continue;

      // Skip local project folders/files that omitted relative prefix
      const isLocal = filePaths.some((p) => {
        const cleanP = p.replace(/\.(js|jsx)$/, "");
        return (
          cleanP === "/" + pkg ||
          cleanP.startsWith("/" + pkg + "/") ||
          p === `/${importTarget}` ||
          p.startsWith(`/${importTarget}/`)
        );
      });
      if (isLocal) continue;

      // Filter out invalid names and server modules
      if (!isValidNpmPackageName(pkg)) {
        continue;
      }

      // If package already has a version from package.json, preserve it
      if (!deps[pkg]) {
        deps[pkg] = DEFAULT_PACKAGE_VERSIONS[pkg] || "^1.0.0";
      }
    }
  }

  // 3. Ensure React and React DOM are explicitly pinned to compatible React 18 versions
  deps["react"] = deps["react"] || DEFAULT_PACKAGE_VERSIONS.react;
  deps["react-dom"] = deps["react-dom"] || DEFAULT_PACKAGE_VERSIONS["react-dom"];

  // 4. If options.excludePackage is specified, remove it
  if (options.excludePackage && deps[options.excludePackage]) {
    delete deps[options.excludePackage];
  }

  return deps;
}

/**
 * Validates dependency list and returns structured diagnostics.
 */
export function validateDependenciesMap(dependencies) {
  const errors = [];
  const warnings = [];

  if (!dependencies || typeof dependencies !== "object") {
    return { valid: true, errors, warnings };
  }

  for (const [name, version] of Object.entries(dependencies)) {
    if (!isValidNpmPackageName(name)) {
      errors.push({
        type: "dependency_invalid_name",
        package: name,
        message: `Package name '${name}' is not a valid npm package identifier.`,
      });
    }

    if (FORBIDDEN_CLIENT_MODULES.has(name)) {
      errors.push({
        type: "dependency_forbidden",
        package: name,
        message: `Server/Node.js module '${name}' cannot be resolved in browser Sandpack preview.`,
      });
    }

    if (typeof version !== "string" || !version.trim()) {
      errors.push({
        type: "dependency_invalid_version",
        package: name,
        message: `Package '${name}' has an empty or invalid version specification.`,
      });
    } else if (version === "latest") {
      warnings.push(`Package '${name}' uses unpinned version 'latest'. Pinned semver is recommended for Sandpack.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Normalizes project files and configures them specifically for Sandpack.
 * - For "vanilla" projects:
 *     - Direct file mapping without injecting React boilerplate or npm dependencies.
 *     - Prefers /index.html as active file.
 * - For "react" projects:
 *     - When /App.jsx is present, explicitly imports `./App.jsx` in /index.js and provides
 *       a hidden re-export at /App.js to override Sandpack's built-in "Hello world" /App.js template.
 *     - When only /App.js is present (legacy), imports `./App.js` normally.
 *     - Imports /styles.css in /index.js if /styles.css exists.
 *     - Prefers /App.jsx (falling back to /App.js) as active file.
 *
 * @param {object} projectOrFiles - Project object or files map.
 * @param {object} [options={}] - Options (framework, activeFile, etc.).
 * @returns {{ files: object, activeFile: string, framework: "vanilla"|"react" }}
 */
export function buildSandpackFiles(projectOrFiles, options = {}) {
  const rawFiles = projectOrFiles?.files || projectOrFiles || {};
  const framework =
    options.framework ||
    (projectOrFiles?.framework && projectOrFiles.framework !== "auto"
      ? projectOrFiles.framework
      : resolveProjectFramework(projectOrFiles));

  const spFiles = {};

  // Normalize all project files with leading slashes
  for (const [path, content] of Object.entries(rawFiles)) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const code = typeof content === "string" ? content : content?.content || "";
    spFiles[cleanPath] = { code };
  }

  const existingFileKeys = Object.keys(spFiles);

  // Determine active file
  let resolvedActiveFile = options.activeFile;
  if (!resolvedActiveFile || !existingFileKeys.includes(resolvedActiveFile)) {
    resolvedActiveFile = getDefaultActiveFile({ files: rawFiles, framework });
  }

  if (framework === "vanilla") {
    // Vanilla static project: mark active file cleanly, no React boilerplate
    for (const [path, fileObj] of Object.entries(spFiles)) {
      fileObj.active = path === resolvedActiveFile;
    }
    return {
      files: spFiles,
      activeFile: resolvedActiveFile,
      framework: "vanilla",
    };
  }

  // React project: support both modern /App.jsx and legacy /App.js entry points
  const hasAppJsx = Boolean(spFiles["/App.jsx"]);
  const hasAppJs = Boolean(spFiles["/App.js"]);
  const hasIndexJs = Boolean(spFiles["/index.js"]);
  const hasIndexJsx = Boolean(spFiles["/index.jsx"]);
  const hasStylesCss = Boolean(spFiles["/styles.css"]);

  // Override Sandpack's built-in "react" template /App.js ("Hello world") if /App.jsx is present
  if (hasAppJsx && !hasAppJs) {
    spFiles["/App.js"] = {
      code: 'export { default } from "./App.jsx";\n',
      hidden: true,
    };
  }

  const appImport = hasAppJsx ? "./App.jsx" : "./App.js";

  if (hasIndexJs || hasIndexJsx) {
    // If project already contains index.js / index.jsx, normalize ./App import to explicit target file
    const targetKey = hasIndexJs ? "/index.js" : "/index.jsx";
    if (typeof spFiles[targetKey].code === "string") {
      spFiles[targetKey].code = spFiles[targetKey].code.replace(
        /(['"])\.\/App(?:\.(?:jsx?|tsx?))?(['"])/g,
        `$1${appImport}$2`,
      );
      if (hasStylesCss && !spFiles[targetKey].code.includes("./styles.css")) {
        spFiles[targetKey].code = `import './styles.css';\n` + spFiles[targetKey].code;
      }
    }
  } else {
    // Auto-inject standard React 18 createRoot index.js that explicitly imports target App entry
    spFiles["/index.js"] = {
      code: `import React from 'react';
import { createRoot } from 'react-dom/client';
${hasStylesCss ? "import './styles.css';\n" : ""}import App from '${appImport}';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
`,
      hidden: true,
    };
  }

  for (const [path, fileObj] of Object.entries(spFiles)) {
    fileObj.active = path === resolvedActiveFile;
  }

  return {
    files: spFiles,
    activeFile: resolvedActiveFile,
    framework: "react",
  };
}

/**
 * Builds the complete Sandpack configuration (template, files, customSetup, options).
 *
 * @param {object} projectOrFiles - Project object or files map.
 * @param {object} [options={}] - Options (framework, activeFile, ignoredPackages, externalResources).
 * @returns {object} Full SandpackProvider configuration bundle.
 */
export function buildSandpackConfig(projectOrFiles, options = {}) {
  const framework =
    options.framework ||
    (projectOrFiles?.framework && projectOrFiles.framework !== "auto"
      ? projectOrFiles.framework
      : resolveProjectFramework(projectOrFiles));

  const { files: sandpackFiles, activeFile } = buildSandpackFiles(projectOrFiles, {
    ...options,
    framework,
  });

  const isVanilla = framework === "vanilla";
  const template = isVanilla ? "static" : "react";

  let dependencies = {};
  if (!isVanilla) {
    const rawFiles = projectOrFiles?.files || projectOrFiles || {};
    dependencies = detectDependencies(rawFiles, { framework: "react" });
    if (options.ignoredPackages) {
      for (const p of options.ignoredPackages) {
        delete dependencies[p];
      }
    }
  }

  const externalResources = [
    "https://cdn.tailwindcss.com",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    ...(options.externalResources || []),
  ];

  return {
    framework,
    template,
    files: sandpackFiles,
    activeFile,
    dependencies,
    customSetup: {
      dependencies,
    },
    options: {
      externalResources,
      classes: {
        "sp-wrapper": "sp-wrapper h-full w-full",
        "sp-layout": "sp-layout h-full w-full",
        "sp-preview": "sp-preview h-full w-full",
      },
      logLevel: 0,
      ...(options.sandpackOptions || {}),
    },
  };
}
