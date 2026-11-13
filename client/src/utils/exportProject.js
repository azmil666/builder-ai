import { detectDependencies } from "./sandpackUtils.js";
import { resolveProjectFramework } from "./frameworkUtils.js";

/**
 * Generates markdown documentation for static HTML/CSS/JS websites.
 */
export function generateVanillaReadme(projectName = "My Website") {
  return `# ${projectName}

This is a standalone static website built with standard HTML5, CSS3, and JavaScript.

## Getting Started

You can run and inspect this website immediately without installing any build tools or dependencies:

1. **Directly in Browser**: Double-click \`index.html\` to open the website in your default web browser.
2. **Local Static Server (Recommended)**:
   \`\`\`bash
   # Option A: Python 3
   python3 -m http.server 8000

   # Option B: Node.js (npx)
   npx serve .
   \`\`\`
   Then open [http://localhost:8000](http://localhost:8000).

## Project Structure

- \`index.html\` — Primary website markup and entry point
- \`styles.css\` — Project styling
- \`script.js\` — Interactive DOM scripts and client logic

## Deployment

Deploy by uploading all files directly to any static web host:
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Vercel](https://vercel.com/) (select "Other" / static framework)
- [Netlify](https://www.netlify.com/) (drag and drop folder)
- [GitHub Pages](https://pages.github.com/)
`;
}

/**
 * Generates markdown documentation for React applications.
 */
export function generateReactReadme(projectName = "My React Website") {
  return `# ${projectName}

A modern React application built with [Vite](https://vitejs.dev/) and [Tailwind CSS](https://tailwindcss.com/).

## Getting Started

1. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the development server**:
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Build for production**:
   \`\`\`bash
   npm run build
   \`\`\`

4. **Preview production build**:
   \`\`\`bash
   npm run preview
   \`\`\`

## Project Structure

- \`src/\` — Application source code (React components, styles, utilities)
- \`index.html\` — Host page and root container
- \`vite.config.js\` — Vite build configuration
- \`package.json\` — Dependencies and scripts
`;
}

/**
 * Constructs a JSZip archive for either a vanilla or react project.
 *
 * @param {object} project - Project object with files map and metadata.
 * @param {Function} JSZip - JSZip constructor.
 * @returns {{ zip: object, framework: "vanilla"|"react" }}
 */
export function buildProjectZip(project, JSZip) {
  if (!project || !JSZip) {
    throw new Error("Project and JSZip instance are required");
  }

  const zip = new JSZip();
  const framework = resolveProjectFramework(project);
  const rawFiles = project.files || {};

  // Normalize files map
  const fileMap = {};
  for (const [path, content] of Object.entries(rawFiles)) {
    const fileCode = typeof content === "string" ? content : content?.content || "";
    fileMap[path] = fileCode;
  }

  const safeProjectName = project.name || (framework === "vanilla" ? "Static Website" : "React Website");

  if (framework === "vanilla") {
    // ----------------------------------------------------
    // VANILLA STATIC EXPORT
    // ----------------------------------------------------
    // Export all files directly at the root — no package.json, vite.config.js, or src/ wrapper
    for (const [path, content] of Object.entries(fileMap)) {
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      zip.file(cleanPath, content);
    }

    // Ensure index.html exists
    if (!fileMap["/index.html"] && !fileMap["index.html"]) {
      zip.file(
        "index.html",
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeProjectName}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>${safeProjectName}</h1>
  <script src="script.js"></script>
</body>
</html>
`,
      );
    }

    // Add concise static README.md
    zip.file("README.md", generateVanillaReadme(safeProjectName));

    return { zip, framework };
  }

  // ----------------------------------------------------
  // REACT VITE EXPORT
  // ----------------------------------------------------
  const detectedDeps = detectDependencies(fileMap, { framework: "react" });
  const hasStylesCss = Boolean(fileMap["/styles.css"] || fileMap["styles.css"]);

  // Add package.json
  zip.file(
    "package.json",
    JSON.stringify(
      {
        name: (project.name || "my-website").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          ...detectedDeps,
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.4",
          vite: "^5.4.11",
          tailwindcss: "^3.4.17",
          autoprefixer: "^10.4.20",
          postcss: "^8.4.49",
        },
      },
      null,
      2,
    ),
  );

  // Add vite.config.js configured for JSX parsing in both .js and .jsx files
  zip.file(
    "vite.config.js",
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\\/.*\\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
`,
  );

  // Add root index.html configured for Vite
  zip.file(
    "index.html",
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeProjectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`,
  );

  // Add src/main.jsx mounting App extensionlessly
  zip.file(
    "src/main.jsx",
    `import React from 'react';
import { createRoot } from 'react-dom/client';
${hasStylesCss ? "import './styles.css';\n" : ""}import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  );

  // Place project source files inside src/
  for (const [path, content] of Object.entries(fileMap)) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    // Skip root index.html since Vite uses the dedicated host index.html
    if (cleanPath === "index.html") {
      continue;
    }
    zip.file(`src/${cleanPath}`, content);
  }

  // Add React README.md
  zip.file("README.md", generateReactReadme(safeProjectName));

  return { zip, framework };
}

/**
 * Generates and downloads a ZIP archive of the project.
 * Uses dynamic imports for code splitting.
 */
export async function exportProjectZip(project) {
  if (!project) return;
  try {
    const jszipModule = await import("jszip");
    const JSZip = jszipModule.default || jszipModule;
    const fileSaverModule = await import("file-saver");
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default;

    const { zip } = buildProjectZip(project, JSZip);
    const blob = await zip.generateAsync({ type: "blob" });
    const fileName = `${(project.name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
    saveAs(blob, fileName);
  } catch (error) {
    console.error("Export project error:", error);
  }
}
