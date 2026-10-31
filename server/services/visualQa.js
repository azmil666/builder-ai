/**
 * Visual Quality Assurance (QA) Engine for Builder AI
 * Analyzes generated React codebases for visual, responsive, asset, and accessibility defects.
 */

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
