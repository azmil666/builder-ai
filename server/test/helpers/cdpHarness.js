import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export function getChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Google Chrome executable not found. Set CHROME_PATH environment variable.");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".jsx": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Starts an ephemeral local static HTTP server for a compiled directory.
 */
export async function startStaticServer(distDir) {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";

    const filePath = path.join(distDir, pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });

  const address = server.address();
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    port,
    baseUrl,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
      }),
  };
}

/**
 * Compiles a deterministic collection of project files into a standalone Vite bundle.
 */
export async function buildFixturePreview(fixtureId, files) {
  const previewDir = path.resolve(__dirname, `../../../client/preview-fixtures/${fixtureId}`);
  fs.rmSync(previewDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(previewDir, "components"), { recursive: true });

  for (const [relPath, content] of Object.entries(files)) {
    let cleanPath = relPath.startsWith("/") ? relPath.slice(1) : relPath;
    let code = content;
    if (cleanPath.endsWith(".js")) {
      cleanPath = cleanPath.replace(/\.js$/, ".jsx");
      code = code.replace(/from\s+['"](\.[^'"]*)\.js['"]/g, "from '$1.jsx'");
    }
    const dest = path.join(previewDir, cleanPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, code, "utf8");
  }

  // Inject index.html and main.jsx
  const hasApp = Object.keys(files).some((p) => p.endsWith("App.js") || p.endsWith("App.jsx"));
  const appFile = hasApp ? "./App.jsx" : "./main.jsx";

  fs.writeFileSync(
    path.join(previewDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Builder AI — Fixture ${fixtureId}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="bg-white text-zinc-900">
    <div id="root"></div>
    <script type="module" src="./entry.jsx"></script>
  </body>
</html>`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(previewDir, "entry.jsx"),
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${appFile}';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    "utf8"
  );

  const { build } = await import("../../../client/node_modules/vite/dist/node/index.js");
  const reactPlugin = (await import("../../../client/node_modules/@vitejs/plugin-react/dist/index.js")).default;
  const tailwindPlugin = (await import("../../../client/node_modules/@tailwindcss/vite/dist/index.mjs")).default;

  const outDir = path.join(previewDir, "dist");
  await build({
    root: previewDir,
    base: "./",
    plugins: [reactPlugin(), tailwindPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
    },
    logLevel: "error",
  });

  return {
    previewDir,
    outDir,
    cleanup: () => {
      fs.rmSync(previewDir, { recursive: true, force: true });
    },
  };
}

/**
 * Headless Google Chrome Session Controller communicating via Chrome DevTools Protocol.
 */
export class CdpSession {
  constructor(chromeProcess, wsUrl, profileDir, port) {
    this.chromeProcess = chromeProcess;
    this.wsUrl = wsUrl;
    this.profileDir = profileDir;
    this.port = port;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.navigationResolvers = [];
    this.closed = false;
  }

  async init(timeoutMs = 10000) {
    this.ws = new WebSocket(this.wsUrl);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket connection to Chrome timed out")), timeoutMs);
      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      this.ws.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject, timer } = this.pending.get(msg.id);
          clearTimeout(timer);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(`CDP Error (${msg.error.code}): ${msg.error.message}`));
          } else {
            resolve(msg.result);
          }
          return;
        }

        // Handle async CDP events
        if (msg.method === "Page.loadEventFired") {
          for (const resolver of this.navigationResolvers) resolver();
          this.navigationResolvers = [];
        } else if (msg.method === "Runtime.consoleAPICalled") {
          const type = msg.params.type;
          const text = (msg.params.args || [])
            .map((a) => (a.value !== undefined ? String(a.value) : a.description || ""))
            .join(" ");
          if (type === "error") {
            this.consoleErrors.push({ type, text, timestamp: msg.params.timestamp });
          }
        } else if (msg.method === "Runtime.exceptionThrown") {
          const ex = msg.params.exceptionDetails;
          const text = ex.exception?.description || ex.text || "Unknown uncaught exception";
          this.exceptions.push({
            message: text,
            lineNumber: ex.lineNumber,
            columnNumber: ex.columnNumber,
            url: ex.url,
          });
        }
      } catch (err) {
        console.warn("[CDP Parse Error]", err);
      }
    };

    // Enable standard domains
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("DOM.enable");
  }

  send(method, params = {}, timeoutMs = 10000) {
    if (this.closed) throw new Error("CDP session is closed");
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(payload);
    });
  }

  async navigate(url, timeoutMs = 15000) {
    const loadPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Navigation to ${url} timed out`)), timeoutMs);
      this.navigationResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    await this.send("Page.navigate", { url });
    await loadPromise;
    // Allow React mounting and microtasks to settle
    await this.evaluate("new Promise(r => setTimeout(r, 100))");
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
      screenOrientation: isMobile
        ? { angle: 0, type: "portraitPrimary" }
        : { angle: 0, type: "landscapePrimary" },
    });
    // Brief settle time for media query evaluation
    await this.evaluate("new Promise(r => setTimeout(r, 50))");
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async click(selector) {
    const script = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found for click: ' + ${JSON.stringify(selector)});
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      })()
    `;
    await this.evaluate(script);
    await this.evaluate("new Promise(r => setTimeout(r, 80))");
  }

  async type(selector, text) {
    const script = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found for type: ' + ${JSON.stringify(selector)});
        el.focus();
        
        // Native React-controlled input/textarea value setter hook
        const proto = el instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        
        if (nativeSetter) {
          nativeSetter.call(el, ${JSON.stringify(text)});
        } else {
          el.value = ${JSON.stringify(text)};
        }
        
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;
    await this.evaluate(script);
    await this.evaluate("new Promise(r => setTimeout(r, 80))");
  }

  async waitForFunction(fnString, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await this.evaluate(`Boolean(${fnString})`);
      if (ok) return true;
      await this.evaluate("new Promise(r => setTimeout(r, 50))");
    }
    throw new Error(`waitForFunction timed out after ${timeoutMs}ms for: ${fnString}`);
  }

  async waitForSelector(selector, timeoutMs = 5000) {
    const fn = `Boolean(document.querySelector(${JSON.stringify(selector)}))`;
    await this.waitForFunction(fn, timeoutMs);
  }

  async getMetrics() {
    return await this.evaluate(`
      (() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          clientWidth: doc.clientWidth,
          clientHeight: doc.clientHeight,
          scrollWidth: doc.scrollWidth,
          scrollHeight: doc.scrollHeight,
          bodyScrollWidth: body ? body.scrollWidth : doc.scrollWidth,
          bodyClientWidth: body ? body.clientWidth : doc.clientWidth,
          hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
          overflowDeltaPx: Math.max(0, doc.scrollWidth - doc.clientWidth)
        };
      })()
    `);
  }

  getConsoleErrors() {
    return [...this.consoleErrors, ...this.exceptions];
  }

  clearErrors() {
    this.consoleErrors = [];
    this.exceptions = [];
  }

  async close() {
    if (this.closed) return;
    this.closed = true;

    for (const [id, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error("Session closed"));
    }
    this.pending.clear();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close();
      } catch {}
    }

    if (this.chromeProcess && !this.chromeProcess.killed) {
      try {
        this.chromeProcess.kill("SIGKILL");
      } catch {}
    }

    // Allow process to fully exit before deleting profile
    await new Promise((r) => setTimeout(r, 100));

    try {
      if (fs.existsSync(this.profileDir)) {
        fs.rmSync(this.profileDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

/**
 * Spawns headless Google Chrome and connects via Chrome DevTools Protocol.
 */
export async function launchChrome(options = {}) {
  const chromePath = getChromePath();
  const profileDir = path.resolve(`/tmp/chrome-cdp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const windowWidth = options.width || 1440;
  const windowHeight = options.height || 900;

  const chromeProcess = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-default-apps",
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${windowWidth},${windowHeight}`,
    "about:blank",
  ]);

  let port = null;
  let wsUrl = null;

  // Poll for DevToolsActivePort file
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const activePortFile = path.join(profileDir, "DevToolsActivePort");
    if (fs.existsSync(activePortFile)) {
      try {
        const content = fs.readFileSync(activePortFile, "utf8").trim().split("\n");
        if (content.length >= 2) {
          port = parseInt(content[0], 10);
          break;
        }
      } catch {}
    }
  }

  if (!port) {
    chromeProcess.kill("SIGKILL");
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw new Error("Failed to detect Chrome DevToolsActivePort within 6000ms");
  }

  // Get or create page target
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const targetsRes = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const pageTarget = targetsRes.find((t) => t.type === "page");
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    chromeProcess.kill("SIGKILL");
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw new Error(`Failed to find page target WebSocket URL from Chrome on port ${port}`);
  }

  const session = new CdpSession(chromeProcess, wsUrl, profileDir, port);
  await session.init();

  return session;
}
