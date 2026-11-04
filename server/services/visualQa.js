/**
 * Visual Quality Assurance (QA) Engine for Builder AI
 * Analyzes generated React codebases for visual, responsive, asset, and accessibility defects.
 */

import { generateStructuredObject } from './ai.js';
import { FileCodeSchema } from './aiSchemas.js';
import { buildFileCodeSystem } from './prompts.js';
import { normalizeContent } from './contentNormalizer.js';
import { validateAndFixCode, validateProject } from './codeValidator.js';

// Heuristics for responsive and layout issues
const RESPONSIVE_DEFECT_PATTERNS = [
  {
    category: 'overflow',
    regex: /\b(w-\[\d{4,}px\]|w-\[1[0-9]{3}px\])(?=[\s"'])/g,
    severity: 'critical',
    message: 'Hardcoded large fixed width triggers horizontal overflow on mobile viewports (<768px).',
    suggestedFix: 'Replace fixed width with responsive constraints such as `w-full max-w-5xl mx-auto px-4`.',
  },
  {
    category: 'overflow',
    regex: /(?:container[^"'>]*\bw-screen\b|\bw-screen\b[^"'>]*container|\bw-screen\b[^"'>]*overflow-hidden)/g,
    severity: 'warning',
    message: '`w-screen` combined with scrollbars or container constraints can cause unwanted horizontal scrollbars.',
    suggestedFix: 'Use `w-full` instead of `w-screen` inside container elements.',
  },
  {
    category: 'responsive',
    regex: /(?<!\b(?:sm|md|lg|xl|2xl):)\b(grid-cols-[3-9]|grid-cols-1[0-2])\b/g,
    severity: 'warning',
    message: 'Multi-column grid without responsive mobile breakpoint wraps or cramps content on small screens.',
    suggestedFix: 'Prefix multi-column grid with breakpoint (e.g. `grid-cols-1 md:grid-cols-3`).',
  },
  {
    category: 'responsive',
    regex: /\b(h-\[\d{4,}px\])(?=[\s"'])/g,
    severity: 'warning',
    message: 'Fixed large pixel height restricts responsive content reflow on mobile.',
    suggestedFix: 'Use `min-h-[...]` or fluid layout with `py-16 sm:py-24` instead of fixed height.',
  },
];

// Heuristics for asset defects
const ASSET_DEFECT_PATTERNS = [
  {
    category: 'assets',
    regex: /src=["']https:\/\/via\.placeholder\.com\/[^"']*["']/g,
    severity: 'warning',
    message: 'Generic placeholder image URL detected.',
    suggestedFix: 'Replace with curated Unsplash imagery or Lucide SVG illustration.',
  },
  {
    category: 'assets',
    regex: /src=["'](?:http:\/\/|https:\/\/)example\.com\/[^"']*["']/g,
    severity: 'critical',
    message: 'Dead example.com placeholder URL will fail to load in preview.',
    suggestedFix: 'Use real public CDN asset URL or royalty-free photo.',
  },
];

// Heuristics for accessibility defects
const ACCESSIBILITY_DEFECT_PATTERNS = [
  {
    category: 'accessibility',
    regex: /<img\b(?![^>]*\balt=)[^>]*>/gi,
    severity: 'warning',
    message: '`<img>` element missing `alt` attribute for screen readers and search engines.',
    suggestedFix: 'Add descriptive `alt="..."` attribute to all image elements.',
  },
  {
    category: 'accessibility',
    regex: /<button\b(?![^>]*\b(aria-label|title)=)[^>]*>\s*<[A-Z][a-zA-Z0-9]*Icon\b[^>]*\/>\s*<\/button>/gi,
    severity: 'warning',
    message: 'Icon-only `<button>` lacks accessible `aria-label` or text label.',
    suggestedFix: 'Add `aria-label="Action description"` to icon-only buttons.',
  },
];

/**
 * Analyzes a collection of project files against Visual QA rules and DesignSpec.
 */
export function analyzeProjectVisualQuality(files = {}, designSpec = null) {
  const issues = [];
  const filesList = Object.entries(files);

  for (const [filePath, fileObj] of filesList) {
    const content = typeof fileObj === 'string' ? fileObj : fileObj?.content || '';
    if (!content) continue;

    const lines = content.split('\n');

    // 1. Check Responsive & Overflow Patterns
    for (const pattern of RESPONSIVE_DEFECT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Find line number
        const preMatch = content.slice(0, match.index);
        const line = preMatch.split('\n').length;
        issues.push({
          category: pattern.category,
          severity: pattern.severity,
          file: filePath,
          line,
          codeSnippet: match[0],
          message: pattern.message,
          suggestedFix: pattern.suggestedFix,
        });
      }
    }

    // 2. Check Asset Patterns
    for (const pattern of ASSET_DEFECT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length;
        issues.push({
          category: pattern.category,
          severity: pattern.severity,
          file: filePath,
          line,
          codeSnippet: match[0],
          message: pattern.message,
          suggestedFix: pattern.suggestedFix,
        });
      }
    }

    // 3. Check Accessibility Patterns
    for (const pattern of ACCESSIBILITY_DEFECT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length;
        issues.push({
          category: pattern.category,
          severity: pattern.severity,
          file: filePath,
          line,
          codeSnippet: match[0],
          message: pattern.message,
          suggestedFix: pattern.suggestedFix,
        });
      }
    }

    // 4. Check Typography Consistency
    if (designSpec?.typography?.headingFont && filePath === '/styles.css') {
      const headingFont = designSpec.typography.headingFont;
      const fontNormalized = headingFont.toLowerCase().replace(/[\s+_-]+/g, '');
      const contentNormalized = content.toLowerCase().replace(/[\s+_-]+/g, '');

      if (!contentNormalized.includes(fontNormalized)) {
        issues.push({
          category: 'typography',
          severity: 'warning',
          file: '/styles.css',
          line: 1,
          message: `Declared heading font "${headingFont}" is missing import statement in stylesheet.`,
          suggestedFix: `Add Google Font import for "${headingFont}" in /styles.css.`,
        });
      }
    }
  }

  // Calculate summary counts
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter((i) => i.severity === 'critical').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    categories: {
      overflow: issues.filter((i) => i.category === 'overflow').length,
      responsive: issues.filter((i) => i.category === 'responsive').length,
      assets: issues.filter((i) => i.category === 'assets').length,
      typography: issues.filter((i) => i.category === 'typography').length,
      accessibility: issues.filter((i) => i.category === 'accessibility').length,
      runtime: 0,
    },
  };

  return {
    evaluationType: 'static_code_heuristics',
    timestamp: new Date().toISOString(),
    status: summary.critical === 0 ? 'passed' : 'defects_detected',
    summary,
    issues,
    archetypeCompliance: {
      archetype: designSpec?.archetype || 'minimal-saas',
      compliant: summary.critical === 0,
    },
  };
}

/**
 * Evaluates rendered browser/DOM layout metrics extracted from live headless browser execution.
 * Evaluates: Visual hierarchy, Spacing consistency, Typography, Image presentation,
 * Responsive layouts, Overflow/clipping, and Empty/unfinished sections.
 */
export function evaluateRenderedVisualQuality(domMetrics = {}, designSpec = null) {
  const issues = [];
  const checks = {
    visualHierarchy: { passed: true, score: 100, details: [] },
    spacingConsistency: { passed: true, score: 100, details: [] },
    typography: { passed: true, score: 100, details: [] },
    imagePresentation: { passed: true, score: 100, details: [] },
    responsiveLayouts: { passed: true, score: 100, details: [] },
    overflowAndClipping: { passed: true, score: 100, details: [] },
    emptyOrUnfinishedSections: { passed: true, score: 100, details: [] },
  };

  const viewportWidth = domMetrics.viewportWidth || 1280;
  const viewportHeight = domMetrics.viewportHeight || 800;

  // 1. Overflow & Clipping Evaluation
  const scrollWidth = domMetrics.scrollWidth || domMetrics.bodyScrollWidth || viewportWidth;
  const clientWidth = domMetrics.clientWidth || domMetrics.bodyClientWidth || viewportWidth;
  if (scrollWidth > clientWidth + 2) {
    const delta = scrollWidth - clientWidth;
    checks.overflowAndClipping.passed = false;
    checks.overflowAndClipping.score = Math.max(0, 100 - delta * 2);
    checks.overflowAndClipping.details.push(
      `Horizontal overflow detected: scrollWidth (${scrollWidth}px) exceeds clientWidth (${clientWidth}px) by ${delta}px.`,
    );
    issues.push({
      category: 'overflow',
      severity: 'critical',
      message: `Rendered viewport (${viewportWidth}px) has ${delta}px horizontal overflow causing page clipping.`,
      suggestedFix: 'Wrap horizontal toolbars with flex-wrap and avoid fixed pixel widths.',
    });
  }

  // 2. Visual Hierarchy Evaluation
  const headings = domMetrics.headings || [];
  if (headings.length > 0) {
    const h1 = headings.find((h) => h.tag === 'H1');
    const h2 = headings.find((h) => h.tag === 'H2');
    if (h1 && h2 && h1.fontSize <= h2.fontSize) {
      checks.visualHierarchy.passed = false;
      checks.visualHierarchy.score = 75;
      checks.visualHierarchy.details.push(
        `Heading hierarchy inversion: H1 size (${h1.fontSize}px) is less than or equal to H2 size (${h2.fontSize}px).`,
      );
      issues.push({
        category: 'visualHierarchy',
        severity: 'warning',
        message: `H1 font size (${h1.fontSize}px) does not establish clear hierarchy over H2 (${h2.fontSize}px).`,
        suggestedFix: 'Ensure H1 is prominently scaled above secondary section titles.',
      });
    } else {
      checks.visualHierarchy.details.push('Heading hierarchy properly establishes distinct font-size progression.');
    }
  }

  // 3. Typography Evaluation
  const computedHeadingFont = domMetrics.computedHeadingFont || '';
  if (designSpec?.typography?.heading?.family && computedHeadingFont) {
    const declaredFamily = designSpec.typography.heading.family.toLowerCase();
    if (!computedHeadingFont.toLowerCase().includes(declaredFamily)) {
      checks.typography.passed = false;
      checks.typography.score = 80;
      checks.typography.details.push(
        `Declared heading font "${designSpec.typography.heading.family}" rendered with fallback "${computedHeadingFont}".`,
      );
    } else {
      checks.typography.details.push(
        `Rendered font family matches declared DesignSpec font "${designSpec.typography.heading.family}".`,
      );
    }
  }

  // 4. Image Presentation & Diversity Evaluation
  const images = domMetrics.images || [];
  const srcCounts = {};
  let brokenImagesCount = 0;
  for (const img of images) {
    if (img.src) {
      srcCounts[img.src] = (srcCounts[img.src] || 0) + 1;
    }
    if (img.naturalWidth === 0 && img.loaded === false) {
      brokenImagesCount++;
    }
  }

  if (brokenImagesCount > 0) {
    checks.imagePresentation.passed = false;
    checks.imagePresentation.score = Math.max(0, 100 - brokenImagesCount * 25);
    issues.push({
      category: 'imagePresentation',
      severity: 'critical',
      message: `${brokenImagesCount} rendered image(s) failed to load.`,
      suggestedFix: 'Ensure all image URLs point to live, accessible CDN endpoints.',
    });
  }

  const duplicateSrcs = Object.entries(srcCounts).filter(([, count]) => count > 2);
  if (duplicateSrcs.length > 0) {
    checks.imagePresentation.passed = false;
    checks.imagePresentation.score = Math.min(checks.imagePresentation.score, 80);
    checks.imagePresentation.details.push(
      `Image reuse detected: ${duplicateSrcs.length} image URL(s) were repeated more than twice across items.`,
    );
    issues.push({
      category: 'imagePresentation',
      severity: 'warning',
      message: 'Product cards reuse duplicate image URLs instead of showcasing varied catalog items.',
      suggestedFix: 'Supply distinct Unsplash URLs for each product in the data catalog.',
    });
  }

  // 5. Spacing Consistency & Negative Margins
  if (domMetrics.overlappingElements && domMetrics.overlappingElements.length > 0) {
    checks.spacingConsistency.passed = false;
    checks.spacingConsistency.score = 70;
    issues.push({
      category: 'spacingConsistency',
      severity: 'warning',
      message: `${domMetrics.overlappingElements.length} overlapping element collision(s) detected in rendered layout.`,
      suggestedFix: 'Review positioning rules and spacing utilities.',
    });
  }

  // 6. Empty or Unfinished Sections
  const emptySections = domMetrics.emptySections || [];
  if (emptySections.length > 0) {
    checks.emptyOrUnfinishedSections.passed = false;
    checks.emptyOrUnfinishedSections.score = 60;
    issues.push({
      category: 'emptyOrUnfinishedSections',
      severity: 'critical',
      message: `${emptySections.length} container section(s) rendered with 0px height or missing content.`,
      suggestedFix: 'Ensure all planned components return populated JSX templates.',
    });
  }

  // 7. Responsive Layout Verification
  if (viewportWidth < 360) {
    if (scrollWidth > viewportWidth) {
      checks.responsiveLayouts.passed = false;
      checks.responsiveLayouts.score = 65;
      issues.push({
        category: 'responsiveLayouts',
        severity: 'critical',
        message: `Ultra-compact mobile layout (<360px) broke viewport boundaries (${scrollWidth}px vs ${viewportWidth}px).`,
        suggestedFix: 'Enable flex-wrap on toolbars and search inputs for small viewports.',
      });
    }
  }

  // Calculate overall rendered visual score
  const checkScores = Object.values(checks).map((c) => c.score);
  const overallScore = Math.round(checkScores.reduce((a, b) => a + b, 0) / checkScores.length);
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;

  return {
    evaluationType: 'rendered_browser_visual_qa',
    timestamp: new Date().toISOString(),
    status: criticalCount === 0 ? 'passed' : 'defects_detected',
    viewport: { width: viewportWidth, height: viewportHeight },
    score: overallScore,
    checks,
    issues,
    summary: {
      totalIssues: issues.length,
      critical: criticalCount,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    },
  };
}

/**
 * Returns browser-executable script string to extract DOM layout and render metrics in any browser.
 */
export function getBrowserMetricExtractionScript() {
  return `
    (() => {
      const doc = document.documentElement;
      const body = document.body;
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        tag: h.tagName,
        fontSize: parseFloat(window.getComputedStyle(h).fontSize) || 0,
        fontWeight: window.getComputedStyle(h).fontWeight,
        text: (h.textContent || '').trim().slice(0, 40),
        fontFamily: window.getComputedStyle(h).fontFamily
      }));

      const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        clientWidth: img.clientWidth,
        clientHeight: img.clientHeight,
        loaded: img.complete
      }));

      const h1El = document.querySelector('h1');
      const computedHeadingFont = h1El ? window.getComputedStyle(h1El).fontFamily : '';

      const emptySections = Array.from(document.querySelectorAll('section, main, article')).filter(s => {
        const text = (s.textContent || '').trim();
        return text.length === 0 && s.children.length === 0;
      }).map(s => s.tagName);

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: body ? body.scrollWidth : doc.scrollWidth,
        bodyClientWidth: body ? body.clientWidth : doc.clientWidth,
        headings,
        images,
        computedHeadingFont,
        emptySections,
        title: document.title
      };
    })()
  `;
}

/**
 * Builds a targeted prompt for AI revision using validated Visual QA findings.
 */
export function buildVisualQAFixPrompt(qaReport) {
  if (!qaReport || !qaReport.issues || qaReport.issues.length === 0) {
    return null;
  }

  const issuesList = qaReport.issues
    .map(
      (iss, idx) =>
        `${idx + 1}. [${iss.category.toUpperCase()}] File \`${iss.file}\` (line ${iss.line}): ${iss.message}\n   Suggested Fix: ${iss.suggestedFix}`,
    )
    .join('\n\n');

  return `Please apply targeted fixes for the following visual QA defects without modifying unrelated files or breaking the DesignSpec:

${issuesList}

Ensure mobile viewports (<768px) and desktop viewports are fully responsive and defect-free.`;
}

/**
 * Standard viewports required for post-generation visual verification.
 */
export const VERIFICATION_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

/**
 * Evaluates a single viewport render for runtime errors, compilation errors, and horizontal overflow.
 */
export function evaluateViewportRender({
  viewport,
  metrics = null,
  errors = [],
  compilationError = null,
  timedOut = false,
  infrastructureError = null,
}) {
  const issues = [];
  const vp = {
    name: viewport?.name || (viewport?.width > 768 ? 'desktop' : 'mobile'),
    width: viewport?.width || (viewport?.name === 'mobile' ? 375 : 1440),
    height: viewport?.height || (viewport?.name === 'mobile' ? 812 : 900),
  };

  // 1. Timeouts
  if (timedOut) {
    issues.push({
      type: 'timeout',
      viewport: vp,
      severity: 'critical',
      message: `Render timed out at ${vp.name} viewport (${vp.width}×${vp.height}). Preview failed to load within time limit.`,
      evidence: { timedOut: true },
    });
    return {
      viewport: vp,
      passed: false,
      metrics: null,
      issues,
      error: 'Render timed out',
    };
  }

  // 2. Infrastructure errors
  if (infrastructureError) {
    const infraMsg = typeof infrastructureError === 'string'
      ? infrastructureError
      : infrastructureError.message || String(infrastructureError);
    issues.push({
      type: 'infrastructure_error',
      viewport: vp,
      severity: 'critical',
      message: `Preview infrastructure error at ${vp.name} viewport: ${infraMsg}`,
      evidence: { details: infraMsg },
    });
    return {
      viewport: vp,
      passed: false,
      metrics: null,
      issues,
      error: infraMsg,
    };
  }

  // 3. Compilation errors
  if (compilationError) {
    const compMsg = typeof compilationError === 'string'
      ? compilationError
      : compilationError.message || String(compilationError);
    issues.push({
      type: 'compilation_error',
      viewport: vp,
      severity: 'critical',
      message: `Compilation failed at ${vp.name} viewport: ${compMsg}`,
      evidence: {
        error: compMsg,
        file: compilationError?.file || null,
      },
      file: compilationError?.file || null,
    });
  }

  // 4. Runtime errors
  if (Array.isArray(errors) && errors.length > 0) {
    for (const err of errors) {
      const errMsg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
      issues.push({
        type: 'runtime_error',
        viewport: vp,
        severity: 'critical',
        message: `Runtime render error at ${vp.name} viewport: ${errMsg}`,
        evidence: {
          error: errMsg,
          stack: err?.stack,
          file: err?.file || null,
        },
        file: err?.file || null,
      });
    }
  }

  // 5. Horizontal overflow (scrollWidth > clientWidth)
  if (metrics) {
    const scrollWidth = Number(metrics.scrollWidth ?? metrics.bodyScrollWidth ?? vp.width);
    const clientWidth = Number(metrics.clientWidth ?? metrics.bodyClientWidth ?? vp.width);

    if (scrollWidth > clientWidth) {
      const overflowPx = Math.round(scrollWidth - clientWidth);
      issues.push({
        type: 'overflow',
        viewport: vp,
        severity: 'critical',
        message: `Horizontal document overflow detected at ${vp.name} viewport: scrollWidth (${scrollWidth}px) exceeds clientWidth (${clientWidth}px) by ${overflowPx}px.`,
        evidence: {
          scrollWidth,
          clientWidth,
          overflowPx,
        },
      });
    }
  }

  const passed = issues.length === 0;

  return {
    viewport: vp,
    passed,
    metrics: metrics
      ? {
          scrollWidth: metrics.scrollWidth ?? metrics.bodyScrollWidth,
          clientWidth: metrics.clientWidth ?? metrics.bodyClientWidth,
          scrollHeight: metrics.scrollHeight ?? metrics.bodyScrollHeight,
          clientHeight: metrics.clientHeight ?? metrics.bodyClientHeight,
        }
      : null,
    issues,
    error: issues.length > 0 ? issues[0].message : null,
  };
}

/**
 * Aggregates viewport verification results into a unified report.
 */
export function aggregateVisualVerificationResults(viewportResults = []) {
  const issues = [];
  const viewports = {};
  let allPassed = viewportResults.length > 0;
  let hasTimeoutOrInfra = false;

  for (const res of viewportResults) {
    viewports[res.viewport.name] = res;
    if (res.issues && res.issues.length > 0) {
      issues.push(...res.issues);
      allPassed = false;
    }
    if (res.issues?.some((i) => i.type === 'timeout' || i.type === 'infrastructure_error')) {
      hasTimeoutOrInfra = true;
    }
  }

  let status = 'verified';
  if (hasTimeoutOrInfra) {
    status = 'unavailable';
  } else if (!allPassed) {
    status = 'defects_detected';
  }

  return {
    status,
    passed: allPassed,
    timestamp: new Date().toISOString(),
    viewports,
    issues,
    summary: {
      totalIssues: issues.length,
      overflowCount: issues.filter((i) => i.type === 'overflow').length,
      runtimeErrorCount: issues.filter((i) => i.type === 'runtime_error').length,
      compilationErrorCount: issues.filter((i) => i.type === 'compilation_error').length,
      timeoutCount: issues.filter((i) => i.type === 'timeout').length,
      infrastructureCount: issues.filter((i) => i.type === 'infrastructure_error').length,
    },
  };
}

/**
 * Builds targeted repair instructions identifying candidate broken files and evidence.
 */
export function buildVisualRepairContext({ issues, files = {}, designSpec = null, prompt = '' }) {
  const candidateFiles = new Set();

  for (const issue of issues) {
    if (issue.file && files[issue.file]) {
      candidateFiles.add(issue.file);
    }
    if (issue.type === 'overflow') {
      for (const [path, content] of Object.entries(files)) {
        const code = typeof content === 'string' ? content : content?.content || '';
        if (
          /\b(w-\[\d{3,}px\]|min-w-\[\d{3,}px\]|w-screen|overflow-x-visible)\b/.test(code) ||
          (issue.viewport.width < 768 && /\bgrid-cols-[2-9]\b/.test(code) && !/\bsm:grid-cols\b/.test(code))
        ) {
          candidateFiles.add(path);
        }
      }
    }
  }

  // Fallback to top-level layout files if no specific candidate detected
  if (candidateFiles.size === 0) {
    if (files['/styles.css']) candidateFiles.add('/styles.css');
    if (files['/App.js']) candidateFiles.add('/App.js');
    for (const key of Object.keys(files)) {
      if (/navbar|header|hero/i.test(key)) {
        candidateFiles.add(key);
      }
    }
  }

  const issueDescriptions = issues
    .map((iss, idx) => {
      let desc = `${idx + 1}. [${iss.type.toUpperCase()}] at viewport "${iss.viewport.name}" (${iss.viewport.width}×${iss.viewport.height}): ${iss.message}`;
      if (iss.evidence?.overflowPx) {
        desc += `\n   Overflow evidence: scrollWidth (${iss.evidence.scrollWidth}px) > clientWidth (${iss.evidence.clientWidth}px) by ${iss.evidence.overflowPx}px.`;
      }
      if (iss.evidence?.error) {
        desc += `\n   Error trace: ${iss.evidence.error}`;
      }
      return desc;
    })
    .join('\n\n');

  const filesToRepair = Array.from(candidateFiles);

  const repairPrompt = `Targeted Visual Defect Fix Request:

The website rendered with visual defects at specific viewports:
${issueDescriptions}

Relevant file(s) identified for repair:
${filesToRepair.map((f) => `- \`${f}\``).join('\n')}

Instructions:
1. Fix horizontal document overflow by replacing hardcoded widths (e.g. w-[...px], w-screen) with responsive fluid classes (\`w-full max-w-...\`, flex-wrap, overflow-x-hidden on outer shell).
2. For mobile viewports (<768px), ensure headers, navigation, product grids, and toolbars wrap and adapt without clipping.
3. Fix any runtime or compilation errors while preserving existing design tokens, colors, typography, and requested feature functionality.
4. Return the complete corrected code for the requested file only. Do not modify unrelated behavior.`;

  return {
    filesToRepair,
    issueDescriptions,
    repairPrompt,
  };
}

/**
 * Performs at most one targeted AI repair attempt on affected files.
 */
export async function performTargetedVisualRepair({
  files,
  allPlannedFiles = [],
  issues,
  prompt = '',
  designSpec = null,
  callbacks = {},
}) {
  const repairContext = buildVisualRepairContext({ issues, files, designSpec, prompt });
  const filesToRepair = repairContext.filesToRepair;

  console.log(`[Visual QA Repair] Performing targeted visual repair on ${filesToRepair.length} file(s): ${filesToRepair.join(', ')}`);

  let currentFiles = { ...files };
  const repairLogs = [];

  for (const filePath of filesToRepair) {
    const rawContent = currentFiles[filePath];
    const currentCode = typeof rawContent === 'string' ? rawContent : rawContent?.content || '';
    const system = buildFileCodeSystem(allPlannedFiles, currentFiles, designSpec);

    const userPrompt = `Project: ${prompt}

${repairContext.repairPrompt}

Current code for '${filePath}':
\`\`\`${filePath.endsWith('.css') ? 'css' : 'javascript'}
${currentCode}
\`\`\`

Return only the complete repaired code for '${filePath}'.`;

    try {
      const { object } = await generateStructuredObject({
        schema: FileCodeSchema,
        system,
        prompt: userPrompt,
        maxRetries: 1,
      });

      const normalized = normalizeContent(object.code);
      const validation = validateAndFixCode(normalized, filePath, {
        allPlannedFiles,
        existingFiles: Object.keys(currentFiles),
      });

      if (validation.valid || validation.errors.length === 0) {
        currentFiles[filePath] = validation.code;
        repairLogs.push({ file: filePath, success: true });
        if (callbacks?.onFileComplete) {
          await callbacks.onFileComplete(filePath, validation.code);
        }
      } else {
        console.warn(`[Visual QA Repair] Repaired code for ${filePath} failed validation: ${validation.errors[0]?.message}`);
        repairLogs.push({ file: filePath, success: false, errors: validation.errors });
      }
    } catch (err) {
      console.warn(`[Visual QA Repair] AI call failed for ${filePath}: ${err.message}`);
      repairLogs.push({ file: filePath, success: false, error: err.message });
    }
  }

  // Cross-file validation check
  const projectVal = validateProject(currentFiles, allPlannedFiles);
  if (!projectVal.valid && projectVal.errors.length > 0) {
    console.warn(`[Visual QA Repair] Repaired files broke project validation (${projectVal.errors.length} errors). Reverting to best original files.`);
    return {
      success: false,
      files,
      repairedFiles: [],
      repairLogs,
      reverted: true,
    };
  }

  return {
    success: true,
    files: currentFiles,
    repairedFiles: filesToRepair,
    repairLogs,
    reverted: false,
  };
}

/**
 * Runs the complete post-generation visual verification render-and-fix loop.
 */
export async function runVisualVerificationLoop({
  files,
  prompt = '',
  designSpec = null,
  allPlannedFiles = [],
  renderViewportFn,
  callbacks = {},
}) {
  if (!renderViewportFn) {
    return {
      status: 'skipped',
      files,
      visualVerification: {
        status: 'skipped',
        reason: 'No render viewport function provided',
        timestamp: new Date().toISOString(),
        viewports: {},
        issues: [],
        repairAttempted: false,
      },
    };
  }

  const viewportsToCheck = VERIFICATION_VIEWPORTS;

  if (callbacks?.onVerificationStart) {
    await callbacks.onVerificationStart({ viewports: viewportsToCheck, round: 1 });
  }

  // Round 1: Initial Render & Viewport Inspection
  const initialViewportResults = [];
  for (const vp of viewportsToCheck) {
    try {
      const renderOutput = await renderViewportFn({ viewport: vp, files });
      const evaluated = evaluateViewportRender({
        viewport: vp,
        metrics: renderOutput?.metrics,
        errors: renderOutput?.errors,
        compilationError: renderOutput?.compilationError,
        timedOut: renderOutput?.timedOut,
        infrastructureError: renderOutput?.infrastructureError,
      });
      initialViewportResults.push(evaluated);
    } catch (err) {
      initialViewportResults.push(
        evaluateViewportRender({
          viewport: vp,
          infrastructureError: err.message || String(err),
        })
      );
    }
  }

  const initialReport = aggregateVisualVerificationResults(initialViewportResults);

  // If infrastructure failure or timeout occurred
  if (initialReport.status === 'unavailable') {
    return {
      status: 'unavailable',
      files,
      visualVerification: {
        ...initialReport,
        repairAttempted: false,
      },
    };
  }

  // If clean: passed initial verification
  if (initialReport.passed) {
    return {
      status: 'verified',
      files,
      visualVerification: {
        ...initialReport,
        status: 'verified',
        repairAttempted: false,
      },
    };
  }

  // Defects detected! Trigger at most ONE targeted repair attempt
  if (callbacks?.onRepairStart) {
    await callbacks.onRepairStart({
      issues: initialReport.issues,
      round: 1,
      maxAttempts: 1,
    });
  }

  const repairResult = await performTargetedVisualRepair({
    files,
    allPlannedFiles,
    issues: initialReport.issues,
    prompt,
    designSpec,
    callbacks,
  });

  const candidateRepairedFiles = repairResult.files;

  // Round 2: Re-render and Re-verify the repaired project
  if (callbacks?.onReverificationStart) {
    await callbacks.onReverificationStart({ viewports: viewportsToCheck, round: 2 });
  }

  const secondViewportResults = [];
  for (const vp of viewportsToCheck) {
    try {
      const renderOutput = await renderViewportFn({ viewport: vp, files: candidateRepairedFiles });
      const evaluated = evaluateViewportRender({
        viewport: vp,
        metrics: renderOutput?.metrics,
        errors: renderOutput?.errors,
        compilationError: renderOutput?.compilationError,
        timedOut: renderOutput?.timedOut,
        infrastructureError: renderOutput?.infrastructureError,
      });
      secondViewportResults.push(evaluated);
    } catch (err) {
      secondViewportResults.push(
        evaluateViewportRender({
          viewport: vp,
          infrastructureError: err.message || String(err),
        })
      );
    }
  }

  const secondReport = aggregateVisualVerificationResults(secondViewportResults);

  // Determine final outcome
  if (secondReport.passed) {
    return {
      status: 'repaired',
      files: candidateRepairedFiles,
      visualVerification: {
        ...secondReport,
        status: 'repaired',
        repairAttempted: true,
        repairedFiles: repairResult.repairedFiles,
        initialIssues: initialReport.issues,
      },
    };
  }

  // Still failing after single retry: cap attempts, retain best available generated project, clearly report remaining issues
  return {
    status: 'unresolved',
    files: candidateRepairedFiles, // retain best available
    visualVerification: {
      ...secondReport,
      status: 'unresolved',
      repairAttempted: true,
      repairedFiles: repairResult.repairedFiles,
      initialIssues: initialReport.issues,
      remainingIssues: secondReport.issues,
    },
  };
}
