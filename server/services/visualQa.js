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
