import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  launchChrome,
  startStaticServer,
  buildFixturePreview,
} from "./helpers/cdpHarness.js";
import {
  portfolioFixture,
  saasFixture,
  directoryFixture,
  ecommerceFixture,
} from "./helpers/browserFixtures.js";

const VIEWPORTS = [
  { name: "Desktop", width: 1440, height: 900, isMobile: false },
  { name: "Tablet", width: 768, height: 1024, isMobile: false },
  { name: "Mobile", width: 375, height: 812, isMobile: true },
];

/**
 * Reusable helper evaluating responsive metrics and 0px horizontal document overflow.
 */
async function verifyResponsiveDimensions(session, vp, fixtureName) {
  session.clearErrors();
  await session.setViewport(vp.width, vp.height, vp.isMobile);

  const metrics = await session.getMetrics();

  // 1. Actual Viewport Width assertion
  assert.strictEqual(
    metrics.clientWidth,
    vp.width,
    `[${fixtureName} - ${vp.name}] Expected clientWidth ${vp.width}, got ${metrics.clientWidth}`
  );

  // 2. Strict Zero Horizontal Overflow assertion
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth,
    `[${fixtureName} - ${vp.name}] Horizontal document overflow detected! scrollWidth (${metrics.scrollWidth}px) exceeds clientWidth (${metrics.clientWidth}px) by ${metrics.overflowDeltaPx}px`
  );

  // 3. Interactive controls must fit within clientWidth
  const interactiveBounds = await session.evaluate(`
    (() => {
      const elements = Array.from(document.querySelectorAll('button, input, textarea, a'));
      const overflowing = [];
      for (const el of elements) {
        // Skip hidden elements
        if (el.offsetParent === null && el.offsetWidth === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 2) {
          overflowing.push({ tag: el.tagName, id: el.id, class: el.className, right: r.right, windowWidth: window.innerWidth });
        }
      }
      return overflowing;
    })()
  `);
  assert.strictEqual(
    interactiveBounds.length,
    0,
    `[${fixtureName} - ${vp.name}] Interactive elements overflow viewport: ${JSON.stringify(interactiveBounds)}`
  );

  // 4. Section sequential vertical layout assertion
  const layoutCheck = await session.evaluate(`
    (() => {
      const sections = Array.from(document.querySelectorAll('section'));
      for (let i = 0; i < sections.length - 1; i++) {
        const r1 = sections[i].getBoundingClientRect();
        const r2 = sections[i + 1].getBoundingClientRect();
        if (r1.height > 0 && r2.height > 0 && r2.top < r1.top) {
          return { error: 'Section collision: ' + (sections[i+1].id || i+1) + ' appears above ' + (sections[i].id || i) };
        }
      }
      return { ok: true };
    })()
  `);
  assert.ok(layoutCheck.ok, `[${fixtureName} - ${vp.name}] ${layoutCheck.error}`);

  // 5. Console hygiene
  const errors = session.getConsoleErrors();
  assert.strictEqual(
    errors.length,
    0,
    `[${fixtureName} - ${vp.name}] Expected zero console errors/exceptions, got: ${JSON.stringify(errors)}`
  );

  return metrics;
}

describe("Phase 5 Stage 4: Real Browser Responsive QA & Viewport Suite", () => {
  let session;

  before(async () => {
    session = await launchChrome({ width: 1440, height: 900 });
  });

  after(async () => {
    if (session) await session.close();
  });

  // ==========================================================================
  // Fixture A: Modern Portfolio Responsive Verification
  // ==========================================================================
  describe("Fixture A: Modern Portfolio Responsive Layout", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("resp_portfolio", portfolioFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    for (const vp of VIEWPORTS) {
      it(`Portfolio [${vp.name} ${vp.width}x${vp.height}]: Renders cleanly with 0px horizontal overflow`, async () => {
        await session.navigate(server.baseUrl);
        const metrics = await verifyResponsiveDimensions(session, vp, "Portfolio");

        if (vp.name === "Desktop") {
          // Desktop: horizontal navigation links visible, hamburger hidden
          const desktopNavVisible = await session.evaluate(`
            window.getComputedStyle(document.querySelector('nav')).display !== 'none'
          `);
          assert.strictEqual(desktopNavVisible, true, "Desktop navigation must be visible at 1440px");

          const hamburgerVisible = await session.evaluate(`
            window.getComputedStyle(document.getElementById('mobile-menu-toggle')).display !== 'none'
          `);
          assert.strictEqual(hamburgerVisible, false, "Hamburger toggle must be hidden at 1440px");
        } else if (vp.name === "Mobile") {
          // Mobile: hamburger toggle visible, desktop nav hidden
          const hamburgerVisible = await session.evaluate(`
            window.getComputedStyle(document.getElementById('mobile-menu-toggle')).display !== 'none'
          `);
          assert.strictEqual(hamburgerVisible, true, "Hamburger toggle must be visible at 375px");

          const desktopNavVisible = await session.evaluate(`
            window.getComputedStyle(document.querySelector('nav')).display === 'none'
          `);
          assert.strictEqual(desktopNavVisible, true, "Desktop navigation must be hidden at 375px");
        }
      });
    }
  });

  // ==========================================================================
  // Fixture B: SaaS Product Landing Page Responsive Verification
  // ==========================================================================
  describe("Fixture B: SaaS Landing Page Responsive Layout", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("resp_saas", saasFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    for (const vp of VIEWPORTS) {
      it(`SaaS [${vp.name} ${vp.width}x${vp.height}]: Renders cleanly with 0px horizontal overflow`, async () => {
        await session.navigate(server.baseUrl);
        await verifyResponsiveDimensions(session, vp, "SaaS Landing");

        if (vp.name === "Mobile") {
          // Mobile: pricing cards must stack vertically
          const cardPositions = await session.evaluate(`
            Array.from(document.querySelectorAll('#pricing .rounded-xl')).map(c => c.getBoundingClientRect().top)
          `);
          assert.strictEqual(cardPositions.length, 3);
          assert.ok(
            cardPositions[1] > cardPositions[0] && cardPositions[2] > cardPositions[1],
            "Pricing cards must stack vertically on mobile"
          );
        } else if (vp.name === "Desktop") {
          // Desktop: pricing cards side-by-side
          const cardTops = await session.evaluate(`
            Array.from(document.querySelectorAll('#pricing .rounded-xl')).map(c => Math.round(c.getBoundingClientRect().top))
          `);
          assert.strictEqual(cardTops[0], cardTops[1], "Pricing cards must align side-by-side on desktop");
        }
      });
    }
  });

  // ==========================================================================
  // Fixture C: Searchable Dataset Directory Responsive Verification
  // ==========================================================================
  describe("Fixture C: Searchable Directory Responsive Layout", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("resp_directory", directoryFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    for (const vp of VIEWPORTS) {
      it(`Directory [${vp.name} ${vp.width}x${vp.height}]: Renders cleanly with 0px horizontal overflow`, async () => {
        await session.navigate(server.baseUrl);
        await verifyResponsiveDimensions(session, vp, "Directory");

        // Search bar width must be constrained within viewport
        const searchInputWidth = await session.evaluate("document.getElementById('search-input').getBoundingClientRect().width");
        assert.ok(
          searchInputWidth <= vp.width,
          `Search input width (${searchInputWidth}px) exceeds viewport width (${vp.width}px)`
        );
      });
    }
  });

  // ==========================================================================
  // Fixture D: Interactive E-Commerce Application Responsive Verification
  // ==========================================================================
  describe("Fixture D: E-Commerce Storefront Responsive Layout", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("resp_ecommerce", ecommerceFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    for (const vp of VIEWPORTS) {
      it(`Storefront [${vp.name} ${vp.width}x${vp.height}]: Renders cleanly with 0px horizontal overflow`, async () => {
        await session.navigate(server.baseUrl);
        await verifyResponsiveDimensions(session, vp, "E-Commerce");

        // Test Cart Drawer responsiveness
        await session.click("#add-btn-prod_1");
        await session.waitForSelector("#cart-drawer");

        // Cart drawer width must not exceed viewport width
        const drawerWidth = await session.evaluate("document.getElementById('cart-drawer').getBoundingClientRect().width");
        assert.ok(
          drawerWidth <= vp.width,
          `Cart drawer width (${drawerWidth}px) exceeds viewport width (${vp.width}px)`
        );

        // Subtotal and checkout button must remain fully within viewport
        const checkoutRight = await session.evaluate("document.getElementById('checkout-btn').getBoundingClientRect().right");
        assert.ok(
          checkoutRight <= vp.width + 1,
          `Checkout button right edge (${checkoutRight}px) exceeds viewport width (${vp.width}px)`
        );

        // Close drawer to leave clean state
        await session.click("#close-cart-btn");
      });
    }
  });
});

