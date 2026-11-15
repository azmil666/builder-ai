import React, { useEffect, useMemo, useState } from "react";
import { buildSandpackConfig } from "../utils/sandpackUtils";
import { resolveProjectFramework } from "../utils/frameworkUtils";
import SandpackErrorMonitor from "./SandpackErrorMonitor";
import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { AlertTriangle, RotateCw } from "lucide-react";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function injectSeoIntoHtml(html, seo = {}, projectName = "") {
  if (!html || typeof html !== "string") return html;

  const title = seo?.title || projectName || "Published Site";
  const description = seo?.description || "";
  const ogImage = seo?.ogImage || "";
  const favicon = seo?.favicon || "";

  let processed = html;

  if (title) {
    processed = processed.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
    processed = processed.replace(/<meta\s+[^>]*property=["']og:title["'][^>]*>/gi, "");
  }
  if (description) {
    processed = processed.replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, "");
    processed = processed.replace(/<meta\s+[^>]*property=["']og:description["'][^>]*>/gi, "");
  }
  if (ogImage) {
    processed = processed.replace(/<meta\s+[^>]*property=["']og:image["'][^>]*>/gi, "");
  }
  if (favicon) {
    processed = processed.replace(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi, "");
  }

  const tags = [];
  if (title) {
    tags.push(`<title>${escapeHtml(title)}</title>`);
    tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  }
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  }
  if (ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
  }
  if (favicon) {
    tags.push(`<link rel="icon" href="${escapeHtml(favicon)}" />`);
  }

  if (tags.length === 0) return html;

  const tagsString = tags.join("\n    ");

  if (/<head\b[^>]*>/i.test(processed)) {
    return processed.replace(/(<head\b[^>]*>)/i, `$1\n    ${tagsString}`);
  }
  if (/<html\b[^>]*>/i.test(processed)) {
    return processed.replace(/(<html\b[^>]*>)/i, `$1\n  <head>\n    ${tagsString}\n  </head>`);
  }
  return `<head>\n    ${tagsString}\n  </head>\n${processed}`;
}

const FullPagePreview = ({
  files,
  project,
  framework: explicitFramework,
  staticHtml,
  useIframe,
}) => {
  const [showErrorOverlay, setShowErrorOverlay] = useState(true);
  const [detailedError, setDetailedError] = useState(null);
  const [ignoredPackages, setIgnoredPackages] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Dynamic <head> injection on browser window
  useEffect(() => {
    const seo = project?.seo || {};
    const title = seo.title || project?.name || "Published Site";
    const description = seo.description || project?.description || "";
    const ogImage = seo.ogImage || "";
    const favicon = seo.favicon || "";

    const prevTitle = document.title;
    document.title = title;

    const metaCleanups = [];

    const upsertMetaTag = (selector, attribute, attrValue, content) => {
      if (!content) return;
      let el = document.head.querySelector(selector);
      let wasCreated = false;
      let prevContent = null;

      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attribute, attrValue);
        document.head.appendChild(el);
        wasCreated = true;
      } else {
        prevContent = el.getAttribute("content");
      }

      el.setAttribute("content", content);

      metaCleanups.push(() => {
        if (wasCreated) {
          if (el.parentNode) el.parentNode.removeChild(el);
        } else if (prevContent !== null) {
          el.setAttribute("content", prevContent);
        } else {
          el.removeAttribute("content");
        }
      });
    };

    if (title) {
      upsertMetaTag('meta[property="og:title"]', "property", "og:title", title);
    }
    if (description) {
      upsertMetaTag('meta[name="description"]', "name", "description", description);
      upsertMetaTag('meta[property="og:description"]', "property", "og:description", description);
    }
    if (ogImage) {
      upsertMetaTag('meta[property="og:image"]', "property", "og:image", ogImage);
    }

    let faviconCleanup = null;
    if (favicon) {
      let iconEl =
        document.head.querySelector('link[rel="icon"]') ||
        document.head.querySelector('link[rel="shortcut icon"]');
      let wasCreated = false;
      let prevHref = null;

      if (!iconEl) {
        iconEl = document.createElement("link");
        iconEl.setAttribute("rel", "icon");
        document.head.appendChild(iconEl);
        wasCreated = true;
      } else {
        prevHref = iconEl.getAttribute("href");
      }

      iconEl.setAttribute("href", favicon);

      faviconCleanup = () => {
        if (wasCreated) {
          if (iconEl.parentNode) iconEl.parentNode.removeChild(iconEl);
        } else if (prevHref !== null) {
          iconEl.setAttribute("href", prevHref);
        } else {
          iconEl.removeAttribute("href");
        }
      };
    }

    return () => {
      document.title = prevTitle;
      metaCleanups.forEach((cleanup) => cleanup());
      if (faviconCleanup) faviconCleanup();
    };
  }, [project?.seo, project?.name, project?.description]);

  const resolvedFramework = useMemo(() => {
    if (explicitFramework && explicitFramework !== "auto") return explicitFramework;
    if (project?.framework && project.framework !== "auto") return project.framework;
    return resolveProjectFramework(project || files);
  }, [explicitFramework, project, files]);

  // Handle static HTML iframe mode if enabled or requested
  const staticSrcDoc = useMemo(() => {
    const rawHtml = staticHtml || (files && (files["/index.html"] || files["index.html"]));
    const htmlString = typeof rawHtml === "string" ? rawHtml : rawHtml?.content;
    if (htmlString) {
      return injectSeoIntoHtml(htmlString, project?.seo, project?.name);
    }
    return null;
  }, [staticHtml, files, project?.seo, project?.name]);

  const sandpackConfig = useMemo(() => {
    const rawFiles = files || project?.files || {};
    const processedFiles = {};
    for (const [p, content] of Object.entries(rawFiles)) {
      const code = typeof content === "string" ? content : content?.content || "";
      if (
        p === "/index.html" ||
        p === "index.html" ||
        p === "/public/index.html" ||
        p === "public/index.html"
      ) {
        processedFiles[p] =
          typeof content === "object" && content !== null
            ? { ...content, content: injectSeoIntoHtml(code, project?.seo, project?.name) }
            : injectSeoIntoHtml(code, project?.seo, project?.name);
      } else {
        processedFiles[p] = content;
      }
    }

    const targetSource = project ? { ...project, files: processedFiles } : processedFiles;
    const config = buildSandpackConfig(targetSource, {
      framework: resolvedFramework,
      ignoredPackages,
    });

    if (config?.files) {
      for (const [p, fileObj] of Object.entries(config.files)) {
        if (
          (p === "/index.html" ||
            p === "index.html" ||
            p === "/public/index.html" ||
            p === "public/index.html") &&
          typeof fileObj?.code === "string"
        ) {
          fileObj.code = injectSeoIntoHtml(fileObj.code, project?.seo, project?.name);
        }
      }
    }

    return config;
  }, [project, files, resolvedFramework, ignoredPackages]);

  const handleRetry = () => {
    setDetailedError(null);
    setRefreshKey((k) => k + 1);
  };

  const handleIgnore = (pkg) => {
    if (!pkg) return;
    setIgnoredPackages((prev) => new Set([...prev, pkg]));
    setDetailedError(null);
    setRefreshKey((k) => k + 1);
  };

  if (useIframe && staticSrcDoc) {
    return (
      <div className="h-screen w-screen bg-white overflow-hidden relative">
        <iframe
          title={project?.seo?.title || project?.name || "Published Site Preview"}
          srcDoc={staticSrcDoc}
          className="h-full w-full border-none"
          sandbox="allow-scripts allow-forms allow-popups"
        />
      </div>
    );
  }

  const providerKey = `${project?._id || "fullpage"}-${resolvedFramework}-${refreshKey}`;

  return (
    <div className="h-screen w-screen bg-white overflow-hidden relative">
      <SandpackProvider
        key={providerKey}
        template={sandpackConfig.template}
        files={sandpackConfig.files}
        customSetup={sandpackConfig.customSetup}
        options={sandpackConfig.options}
        className="h-full w-full"
      >
        <SandpackErrorMonitor
          onErrorChange={setShowErrorOverlay}
          onDetailedErrorChange={setDetailedError}
        />
        <SandpackLayout className="h-full w-full border-none! bg-transparent! relative">
          {detailedError?.isDependencyError && (
            <div className="absolute inset-x-6 top-6 z-50 bg-zinc-900/95 border border-red-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-md text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">Dependency Resolution Failed</h4>
                    <p className="text-xs text-zinc-300 mt-1">
                      {detailedError.package ? (
                        <>Could not resolve package <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">{detailedError.package}</code>.</>
                      ) : (
                        detailedError.reason || "Unable to download required preview dependencies."
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRetry}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCw size={13} />
                    Retry
                  </button>
                  {detailedError.package && (
                    <button
                      onClick={() => handleIgnore(detailedError.package)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Ignore & Load
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={false}
            showSandpackErrorOverlay={showErrorOverlay}
            className="h-full w-full"
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
};

export default FullPagePreview;
