/**
 * Utilities for multi-target framework support ("vanilla" | "react").
 */

/**
 * Resolves a project's framework target ("vanilla" | "react").
 * Preserves backward compatibility with legacy projects lacking a framework property:
 * infers "vanilla" if /index.html exists without /App.js or /App.jsx, otherwise "react".
 *
 * @param {object|null} project - Project object, files map, or array of file paths.
 * @returns {"vanilla"|"react"} The resolved framework.
 */
export function resolveProjectFramework(project) {
  if (!project) return "react";

  // Explicit framework property takes priority
  if (project.framework === "vanilla" || project.framework === "react") {
    return project.framework;
  }

  // Extract file paths from project.files, an array of paths, or a files map
  const fileKeys = project.files
    ? Object.keys(project.files)
    : Array.isArray(project)
      ? project
      : typeof project === "object"
        ? Object.keys(project)
        : [];

  const hasIndexHtml = fileKeys.some(
    (p) => p === "/index.html" || p === "index.html" || p.endsWith("/index.html")
  );
  const hasReactApp = fileKeys.some(
    (p) =>
      p === "/App.jsx" ||
      p === "/App.js" ||
      p === "App.jsx" ||
      p === "App.js" ||
      p.endsWith("/App.jsx") ||
      p.endsWith("/App.js")
  );

  if (hasIndexHtml && !hasReactApp) {
    return "vanilla";
  }

  return "react";
}

/**
 * Resolves the primary default active file for a project according to its framework.
 * For "vanilla" projects: prefers /index.html.
 * For "react" projects: prefers /App.jsx (falling back to /App.js).
 *
 * @param {object|null} project - Project object or files map.
 * @returns {string} The default file path.
 */
export function getDefaultActiveFile(project) {
  const framework = resolveProjectFramework(project);
  const files = project?.files ? Object.keys(project.files) : Object.keys(project || {});

  if (framework === "vanilla") {
    if (files.includes("/index.html")) return "/index.html";
    if (files.includes("index.html")) return "/index.html";
    if (files.includes("/script.js")) return "/script.js";
    if (files.includes("/styles.css")) return "/styles.css";
    return files[0] || "/index.html";
  }

  // React framework
  if (files.includes("/App.jsx")) return "/App.jsx";
  if (files.includes("/App.js")) return "/App.js";
  if (files.includes("/src/App.jsx")) return "/src/App.jsx";
  if (files.includes("/src/App.js")) return "/src/App.js";
  if (files.includes("/index.html")) return "/index.html";
  return files[0] || "/App.jsx";
}

/**
 * Determines whether a file is a protected entry point that cannot be deleted or renamed.
 * For "vanilla": locks /index.html and /styles.css.
 * For "react": locks /App.jsx, /App.js, and /styles.css.
 *
 * @param {string} filePath - Normalized or relative file path.
 * @param {"vanilla"|"react"} framework - Resolved framework.
 * @returns {boolean} True if the file is protected.
 */
export function isLockedEntryFile(filePath, framework = "react") {
  if (!filePath) return false;
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;

  if (framework === "vanilla") {
    return normalized === "/index.html" || normalized === "/styles.css";
  }

  return (
    normalized === "/App.jsx" ||
    normalized === "/App.js" ||
    normalized === "/styles.css"
  );
}

export const FRAMEWORK_OPTIONS = [
  { id: "auto", label: "Auto", tooltip: "Auto-detect React vs. HTML/CSS/JS" },
  { id: "vanilla", label: "HTML · CSS · JS", tooltip: "Standard HTML5, CSS3, and modern JavaScript" },
  { id: "react", label: "React", tooltip: "Modern React with JSX components" },
];

