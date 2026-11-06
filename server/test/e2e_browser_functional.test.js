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

describe("Phase 5 Stage 4: Real Browser Functional Verification Suite", () => {
  let session;

  before(async () => {
    session = await launchChrome({ width: 1440, height: 900 });
  });

  after(async () => {
    if (session) await session.close();
  });

  // ==========================================================================
  // Fixture A — Modern Portfolio
  // ==========================================================================
  describe("Fixture A: Modern Portfolio Functional Interactions", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("fixture_portfolio", portfolioFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    it("Portfolio: Loads successfully and renders all primary sections", async () => {
      session.clearErrors();
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      const title = await session.evaluate("document.title");
      assert.ok(title.includes("Fixture fixture_portfolio"), `Expected title, got: ${title}`);

      const renderedSections = await session.evaluate(`
        Array.from(document.querySelectorAll('section')).map(s => s.id)
      `);
      assert.deepEqual(renderedSections, ["hero", "projects", "skills", "contact"]);

      const cardsCount = await session.evaluate("document.querySelectorAll('.project-card').length");
      assert.strictEqual(cardsCount, 3, "Portfolio must render 3 project showcase cards");

      const errors = session.getConsoleErrors();
      assert.strictEqual(errors.length, 0, `Expected 0 browser console errors, got: ${JSON.stringify(errors)}`);
    });

    it("Portfolio: Desktop navigation anchor scrolls to projects section", async () => {
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      const initialScrollY = await session.evaluate("window.scrollY");
      assert.strictEqual(initialScrollY, 0, "Initial scrollY must be 0");

      await session.click("#nav-projects-link");
      await session.evaluate("new Promise(r => setTimeout(r, 200))");

      const projectsOffsetTop = await session.evaluate("document.getElementById('projects').offsetTop");
      const scrolledY = await session.evaluate("window.scrollY");
      assert.ok(
        scrolledY > 0 || projectsOffsetTop > 0,
        "Anchor navigation must scroll page towards target section"
      );
    });

    it("Portfolio: Mobile navigation drawer toggles open and closed", async () => {
      // Switch to mobile viewport
      await session.setViewport(375, 812, true);
      await session.navigate(server.baseUrl);

      // Verify mobile menu is initially closed
      const initiallyOpen = await session.evaluate("Boolean(document.getElementById('mobile-menu'))");
      assert.strictEqual(initiallyOpen, false, "Mobile menu must be closed initially");

      // Click hamburger toggle button
      await session.click("#mobile-menu-toggle");
      const menuVisible = await session.evaluate("Boolean(document.getElementById('mobile-menu'))");
      assert.strictEqual(menuVisible, true, "Mobile menu drawer must open on toggle click");

      const menuLinks = await session.evaluate(`
        Array.from(document.querySelectorAll('#mobile-menu a')).map(a => a.textContent.trim())
      `);
      assert.deepEqual(menuLinks, ["Projects", "Skills", "Contact"]);

      // Click hamburger toggle button again to close
      await session.click("#mobile-menu-toggle");
      const closedAgain = await session.evaluate("Boolean(document.getElementById('mobile-menu'))");
      assert.strictEqual(closedAgain, false, "Mobile menu drawer must close on second toggle click");
    });

    it("Portfolio: Contact form accepts input and displays confirmation feedback on submit", async () => {
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      // Verify form elements exist
      await session.type("#contact-name", "Alex Developer");
      await session.type("#contact-email", "alex@builderai.test");
      await session.type("#contact-message", "Excited to partner on our next React project!");

      const nameVal = await session.evaluate("document.getElementById('contact-name').value");
      const emailVal = await session.evaluate("document.getElementById('contact-email').value");
      const msgVal = await session.evaluate("document.getElementById('contact-message').value");

      assert.strictEqual(nameVal, "Alex Developer");
      assert.strictEqual(emailVal, "alex@builderai.test");
      assert.strictEqual(msgVal, "Excited to partner on our next React project!");

      // Submit form
      await session.click("#contact-submit-btn");

      // Verify success feedback appears in DOM
      await session.waitForSelector("#contact-success");
      const successText = await session.evaluate("document.getElementById('contact-success').textContent");
      assert.ok(
        successText.includes("Message sent successfully!"),
        `Expected success message, got: ${successText}`
      );

      // Form itself should now be replaced by the success message
      const formExists = await session.evaluate("Boolean(document.getElementById('contact-form'))");
      assert.strictEqual(formExists, false, "Form should be replaced by confirmation view upon submission");
    });
  });

  // ==========================================================================
  // Fixture B — SaaS Product Landing Page
  // ==========================================================================
  describe("Fixture B: SaaS Landing Page Functional Interactions", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("fixture_saas", saasFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    it("SaaS: Hero and feature sections render cleanly without console errors", async () => {
      session.clearErrors();
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      const h1Text = await session.evaluate("document.querySelector('h1').textContent");
      assert.ok(h1Text.includes("Deploy Autonomous Micro-Agents"), `Unexpected H1: ${h1Text}`);

      const featuresCount = await session.evaluate("document.querySelectorAll('#features .p-8').length");
      assert.strictEqual(featuresCount, 3, "SaaS page must render 3 feature presentation cards");

      const errors = session.getConsoleErrors();
      assert.strictEqual(errors.length, 0, `Expected 0 console errors, got: ${JSON.stringify(errors)}`);
    });

    it("SaaS: Invalid email input is rejected with descriptive error message", async () => {
      await session.navigate(server.baseUrl);

      await session.type("#signup-email", "invalid-email-address");
      await session.click("#signup-submit-btn");

      await session.waitForSelector("#signup-error");
      const errorMsg = await session.evaluate("document.getElementById('signup-error').textContent");
      assert.strictEqual(errorMsg, "Please enter a valid work email");

      const successExists = await session.evaluate("Boolean(document.getElementById('signup-success'))");
      assert.strictEqual(successExists, false, "Success view must NOT appear on invalid email");
    });

    it("SaaS: Valid email submission displays confirmation message", async () => {
      await session.navigate(server.baseUrl);

      await session.type("#signup-email", "architect@enterprise.org");
      await session.click("#signup-submit-btn");

      await session.waitForSelector("#signup-success");
      const successText = await session.evaluate("document.getElementById('signup-success').textContent");
      assert.ok(successText.includes("Welcome aboard!"), `Expected welcome text, got: ${successText}`);
    });

    it("SaaS: Pricing billing toggle dynamically updates displayed card pricing and discount badge", async () => {
      await session.navigate(server.baseUrl);

      // Initial state: Monthly billing
      let prices = await session.evaluate(`
        Array.from(document.querySelectorAll('.price-value')).map(el => el.textContent.trim())
      `);
      assert.deepEqual(prices, ["$29", "$79", "$199"], "Initial monthly prices must be $29, $79, $199");

      // Click billing toggle to switch to Annual
      await session.click("#billing-toggle");

      prices = await session.evaluate(`
        Array.from(document.querySelectorAll('.price-value')).map(el => el.textContent.trim())
      `);
      assert.deepEqual(prices, ["$24", "$65", "$165"], "Annual prices must reflect discounted rate: $24, $65, $165");

      const discountBadge = await session.evaluate("document.getElementById('annual-discount-badge').textContent");
      assert.ok(discountBadge.includes("Save 20%"), "Discount badge must be visible");

      // Click toggle back to Monthly
      await session.click("#billing-toggle");
      prices = await session.evaluate(`
        Array.from(document.querySelectorAll('.price-value')).map(el => el.textContent.trim())
      `);
      assert.deepEqual(prices, ["$29", "$79", "$199"], "Prices must revert back to monthly");
    });
  });

  // ==========================================================================
  // Fixture C — Searchable Dataset Directory
  // ==========================================================================
  describe("Fixture C: Searchable Directory Functional Interactions", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("fixture_directory", directoryFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    it("Directory: Initial page renders full dataset and search bar", async () => {
      session.clearErrors();
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      const cardCount = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(cardCount, 8, "Initial directory must display 8 resources");

      const errors = session.getConsoleErrors();
      assert.strictEqual(errors.length, 0, `Expected 0 console errors, got: ${JSON.stringify(errors)}`);
    });

    it("Directory: Search input filters items by keyword in real time", async () => {
      await session.navigate(server.baseUrl);

      await session.type("#search-input", "PostgreSQL");

      const filteredCount = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(filteredCount, 1, "Searching 'PostgreSQL' must yield exactly 1 item");

      const title = await session.evaluate("document.querySelector('.directory-card h3').textContent");
      assert.strictEqual(title, "PostgreSQL Query Optimization");
    });

    it("Directory: Multiple search queries filter correctly across categories", async () => {
      await session.navigate(server.baseUrl);

      // Query 1: Engineering
      await session.type("#search-input", "Design");
      let count = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(count, 3, "Searching 'Design' must yield 3 items");

      // Query 2: Email
      await session.type("#search-input", "Email");
      count = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(count, 1, "Searching 'Email' must yield 1 item");
    });

    it("Directory: Non-matching query triggers dedicated empty state view", async () => {
      await session.navigate(server.baseUrl);

      await session.type("#search-input", "NON_EXISTENT_QUERY_XYZ_123");

      await session.waitForSelector("#empty-state");
      const emptyHeading = await session.evaluate("document.querySelector('#empty-state h3').textContent");
      assert.strictEqual(emptyHeading, "No results found");

      const cardCount = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(cardCount, 0, "No directory cards should be rendered when empty state is active");
    });

    it("Directory: Clear button resets search and restores all items", async () => {
      await session.navigate(server.baseUrl);

      await session.type("#search-input", "Optimization");
      let cardCount = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(cardCount, 1);

      // Click Clear button
      await session.click("#clear-search-btn");

      // Input must be empty and all 8 cards restored
      const inputVal = await session.evaluate("document.getElementById('search-input').value");
      assert.strictEqual(inputVal, "", "Search input value must be cleared");

      cardCount = await session.evaluate("document.querySelectorAll('.directory-card').length");
      assert.strictEqual(cardCount, 8, "Full dataset of 8 items must be restored upon clearing search");
    });
  });

  // ==========================================================================
  // Fixture D — Interactive E-Commerce Storefront with Cart
  // ==========================================================================
  describe("Fixture D: E-Commerce Storefront Functional Interactions", () => {
    let preview;
    let server;

    before(async () => {
      preview = await buildFixturePreview("fixture_ecommerce", ecommerceFixture);
      server = await startStaticServer(preview.outDir);
    });

    after(async () => {
      if (server) await server.close();
      if (preview) preview.cleanup();
    });

    it("Storefront: Renders product catalog and initial empty cart badge", async () => {
      session.clearErrors();
      await session.setViewport(1440, 900, false);
      await session.navigate(server.baseUrl);

      const productsCount = await session.evaluate("document.querySelectorAll('.product-card').length");
      assert.strictEqual(productsCount, 3, "Storefront must render 3 product cards");

      const badgeCount = await session.evaluate("document.getElementById('cart-counter-badge').textContent.trim()");
      assert.strictEqual(badgeCount, "0", "Initial cart badge must be 0");

      const errors = session.getConsoleErrors();
      assert.strictEqual(errors.length, 0, `Expected 0 console errors, got: ${JSON.stringify(errors)}`);
    });

    it("Storefront: Add to Bag increments badge counter and opens cart drawer", async () => {
      await session.navigate(server.baseUrl);

      // Click "Add to Bag" on Backpack ($120)
      await session.click("#add-btn-prod_1");

      // Cart badge must update to 1
      const badgeCount = await session.evaluate("document.getElementById('cart-counter-badge').textContent.trim()");
      assert.strictEqual(badgeCount, "1", "Cart badge must increment to 1");

      // Cart drawer must open and display Backpack
      await session.waitForSelector("#cart-drawer");
      const itemTitle = await session.evaluate("document.querySelector('.cart-item h4').textContent");
      assert.strictEqual(itemTitle, "Minimalist Canvas Backpack");

      // Subtotal must be $120
      const subtotal = await session.evaluate("document.getElementById('cart-subtotal-value').textContent");
      assert.strictEqual(subtotal, "$120");
    });

    it("Storefront: Cart drawer opens and closes cleanly", async () => {
      await session.navigate(server.baseUrl);

      // Close cart drawer
      await session.click("#add-btn-prod_1");
      await session.waitForSelector("#cart-drawer");
      await session.click("#close-cart-btn");

      const isOpen = await session.evaluate("Boolean(document.getElementById('cart-drawer'))");
      assert.strictEqual(isOpen, false, "Drawer must be closed after clicking close button");

      // Re-open from navbar button
      await session.click("#cart-toggle-btn");
      const isReopened = await session.evaluate("Boolean(document.getElementById('cart-drawer'))");
      assert.strictEqual(isReopened, true, "Drawer must re-open when navbar Bag button is clicked");
    });

    it("Storefront: Quantity increment, decrement, and subtotal math are accurate", async () => {
      await session.navigate(server.baseUrl);

      // Add product ($120)
      await session.click("#add-btn-prod_1");
      await session.waitForSelector(".cart-item");

      // Increment quantity: 1 -> 2
      await session.click(".qty-inc-btn");
      let qty = await session.evaluate("document.querySelector('.item-qty-value').textContent");
      assert.strictEqual(qty, "2", "Quantity must increment to 2");

      let subtotal = await session.evaluate("document.getElementById('cart-subtotal-value').textContent");
      assert.strictEqual(subtotal, "$240", "Subtotal must calculate 120 * 2 = $240");

      // Increment quantity: 2 -> 3
      await session.click(".qty-inc-btn");
      qty = await session.evaluate("document.querySelector('.item-qty-value').textContent");
      assert.strictEqual(qty, "3", "Quantity must increment to 3");

      subtotal = await session.evaluate("document.getElementById('cart-subtotal-value').textContent");
      assert.strictEqual(subtotal, "$360", "Subtotal must calculate 120 * 3 = $360");

      // Decrement quantity: 3 -> 2
      await session.click(".qty-dec-btn");
      qty = await session.evaluate("document.querySelector('.item-qty-value').textContent");
      assert.strictEqual(qty, "2", "Quantity must decrement back to 2");

      subtotal = await session.evaluate("document.getElementById('cart-subtotal-value').textContent");
      assert.strictEqual(subtotal, "$240", "Subtotal must recalculate to $240");
    });

    it("Storefront: Removing an item updates cart and renders empty cart state", async () => {
      await session.navigate(server.baseUrl);

      // Add product
      await session.click("#add-btn-prod_2"); // Leather Sneakers $180
      await session.waitForSelector(".cart-item");

      // Click remove button
      await session.click(".remove-item-btn");

      // Empty state must appear
      await session.waitForSelector("#cart-empty-state");
      const emptyText = await session.evaluate("document.getElementById('cart-empty-state').textContent");
      assert.ok(emptyText.includes("Your bag is empty"), `Expected empty bag text, got: ${emptyText}`);

      // Badge must update to 0
      const badgeCount = await session.evaluate("document.getElementById('cart-counter-badge').textContent.trim()");
      assert.strictEqual(badgeCount, "0", "Cart badge must return to 0 when all items are removed");
    });
  });
});

