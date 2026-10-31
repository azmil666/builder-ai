import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateRenderedVisualQuality,
  getBrowserMetricExtractionScript,
} from '../services/visualQa.js';

describe('Rendered Visual QA Engine Suite', () => {
  it('detects horizontal overflow when scrollWidth exceeds clientWidth', () => {
    const overflowMetrics = {
      viewportWidth: 375,
      viewportHeight: 667,
      scrollWidth: 415,
      clientWidth: 375,
    };

    const report = evaluateRenderedVisualQuality(overflowMetrics);
    assert.strictEqual(report.evaluationType, 'rendered_browser_visual_qa');
    assert.strictEqual(report.status, 'defects_detected');
    assert.strictEqual(report.checks.overflowAndClipping.passed, false);
    assert.strictEqual(report.summary.critical, 1);
    assert.ok(report.issues[0].message.includes('40px horizontal overflow'));
  });

  it('detects visual hierarchy inversion when H1 size <= H2 size', () => {
    const hierarchyMetrics = {
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollWidth: 1280,
      clientWidth: 1280,
      headings: [
        { tag: 'H1', fontSize: 24 },
        { tag: 'H2', fontSize: 32 },
      ],
    };

    const report = evaluateRenderedVisualQuality(hierarchyMetrics);
    assert.strictEqual(report.checks.visualHierarchy.passed, false);
    assert.ok(report.issues.some((i) => i.category === 'visualHierarchy'));
  });

  it('detects broken images and image repetition across products', () => {
    const imageMetrics = {
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollWidth: 1280,
      clientWidth: 1280,
      images: [
        { src: 'https://cdn.example.com/item1.jpg', naturalWidth: 0, loaded: false },
        { src: 'https://cdn.example.com/repeat.jpg', naturalWidth: 800, loaded: true },
        { src: 'https://cdn.example.com/repeat.jpg', naturalWidth: 800, loaded: true },
        { src: 'https://cdn.example.com/repeat.jpg', naturalWidth: 800, loaded: true },
      ],
    };

    const report = evaluateRenderedVisualQuality(imageMetrics);
    assert.strictEqual(report.checks.imagePresentation.passed, false);
    assert.ok(report.issues.some((i) => i.message.includes('failed to load')));
    assert.ok(report.issues.some((i) => i.message.includes('duplicate image URLs')));
  });

  it('passes clean rendered layout metrics with score 100', () => {
    const perfectMetrics = {
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollWidth: 1280,
      clientWidth: 1280,
      headings: [
        { tag: 'H1', fontSize: 56 },
        { tag: 'H2', fontSize: 36 },
        { tag: 'H3', fontSize: 24 },
      ],
      computedHeadingFont: 'Syne, sans-serif',
      images: [
        { src: 'https://images.unsplash.com/photo-1', naturalWidth: 1200, loaded: true },
        { src: 'https://images.unsplash.com/photo-2', naturalWidth: 1200, loaded: true },
        { src: 'https://images.unsplash.com/photo-3', naturalWidth: 1200, loaded: true },
      ],
    };

    const designSpec = {
      typography: {
        heading: { family: 'Syne' },
      },
    };

    const report = evaluateRenderedVisualQuality(perfectMetrics, designSpec);
    assert.strictEqual(report.status, 'passed');
    assert.strictEqual(report.score, 100);
    assert.strictEqual(report.summary.totalIssues, 0);
  });

  it('validates ultra-compact mobile layouts (<360px)', () => {
    const ultraCompactMetrics = {
      viewportWidth: 320,
      viewportHeight: 640,
      scrollWidth: 360,
      clientWidth: 320,
    };

    const report = evaluateRenderedVisualQuality(ultraCompactMetrics);
    assert.strictEqual(report.checks.responsiveLayouts.passed, false);
    assert.ok(report.issues.some((i) => i.category === 'responsiveLayouts'));
  });

  it('returns valid JavaScript string from getBrowserMetricExtractionScript', () => {
    const script = getBrowserMetricExtractionScript();
    assert.strictEqual(typeof script, 'string');
    assert.ok(script.includes('viewportWidth'));
    assert.ok(script.includes('scrollWidth'));
    assert.ok(script.includes('headings'));
  });
});

