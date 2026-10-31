import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateProject,
  validatePropContracts,
  verifyProjectRuntime,
  validateAndFixCode,
} from "../services/codeValidator.js";

describe("Critical Runtime Integration & Prop Contract Regression Suite", () => {
  // Test 1: Exact Reproduction of the Luxury Ceramics E-Commerce Failure
  test("1. Reproduces exact ceramics crash: AST contract validator detects missing storeConfig", () => {
    const brokenCeramicsFiles = {
      "/App.js": `
import React, { useState } from "react";
import CartDrawer from "./components/CartDrawer.js";

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState([]);

  return (
    <div className="min-h-screen">
      <h1>Editorial Luxury Ceramics</h1>
      <button onClick={() => setIsCartOpen(true)}>Open Cart</button>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} />
    </div>
  );
}
`,
      "/components/CartDrawer.js": `
import React from "react";
import { X, Trash2 } from "lucide-react";

export default function CartDrawer({ isOpen, onClose, cart, storeConfig }) {
  if (!isOpen) return null;
  const threshold = storeConfig.freeShippingThreshold;

  return (
    <div className="cart-drawer">
      <button onClick={onClose}><X /></button>
      <h2>Shopping Cart</h2>
      <p>Free shipping on orders over: \${threshold}</p>
    </div>
  );
}
`,
    };

    // Run contract validation directly
    const contractResult = validatePropContracts(brokenCeramicsFiles);
    assert.strictEqual(contractResult.errors.length > 0, true, "Contract validation must flag missing prop");
    const missingPropError = contractResult.errors.find((e) => e.prop === "storeConfig");
    assert.ok(missingPropError, "Must specifically flag 'storeConfig' prop");
    assert.strictEqual(missingPropError.type, "prop_contract_mismatch");
    assert.strictEqual(missingPropError.component, "CartDrawer");
    assert.strictEqual(missingPropError.file, "/App.js");
    assert.strictEqual(missingPropError.targetFile, "/components/CartDrawer.js");

    // Project-level validation must also fail
    const projectResult = validateProject(brokenCeramicsFiles);
    assert.strictEqual(projectResult.valid, false, "validateProject must fail for broken prop contracts");
    assert.ok(projectResult.errors.some((e) => e.type === "prop_contract_mismatch"));
  });

  // Test 2: Active-state runtime verification catches TypeError
  test("2. Active-state runtime verification catches uncaught TypeError when isOpen=true", async () => {
    const brokenCeramicsFiles = {
      "/App.js": `
import React, { useState } from "react";
import CartDrawer from "./components/CartDrawer.js";

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  return (
    <div>
      <CartDrawer isOpen={isCartOpen} />
    </div>
  );
}
`,
      "/components/CartDrawer.js": `
import React from "react";

export default function CartDrawer({ isOpen, storeConfig }) {
  if (!isOpen) return null;
  const threshold = storeConfig.freeShippingThreshold;
  return <div>{threshold}</div>;
}
`,
    };

    const runtimeResult = await verifyProjectRuntime(brokenCeramicsFiles);
    assert.strictEqual(runtimeResult.valid, false, "Active-state runtime verification must fail");
    assert.strictEqual(runtimeResult.errors.length, 1);
    assert.strictEqual(runtimeResult.errors[0].type, "runtime_exception");
    assert.strictEqual(runtimeResult.errors[0].file, "/components/CartDrawer.js");
    assert.ok(
      runtimeResult.errors[0].message.includes("Cannot read properties of undefined") ||
      runtimeResult.errors[0].message.includes("freeShippingThreshold"),
      `Error message must pinpoint runtime failure: ${runtimeResult.errors[0].message}`
    );
  });

  // Test 3: Defensive hardening prevents runtime crashes while preserving props
  test("3. Defensive hardening injects safe fallbacks and optional chaining", async () => {
    const rawCartDrawerCode = `
import React from "react";

export default function CartDrawer({ isOpen, onClose, cart, storeConfig }) {
  if (!isOpen) return null;
  const threshold = storeConfig.freeShippingThreshold;
  return <div>{threshold}</div>;
}
`;

    const hardened = validateAndFixCode(rawCartDrawerCode, "/components/CartDrawer.js");
    assert.ok(hardened.code.includes("storeConfig ="), "Must provide safe fallback assignment for storeConfig");
    assert.ok(hardened.code.includes("onClose = () => {}"), "Must provide safe fallback for onClose");
    assert.ok(hardened.code.includes("cart = []"), "Must provide safe fallback for cart");
    assert.ok(
      hardened.code.includes("storeConfig?.freeShippingThreshold") ||
      hardened.code.includes("STORE_CONFIG"),
      "Must safely dereference freeShippingThreshold"
    );

    // Verify hardened component mounts in active state without throwing
    const fixedFiles = {
      "/App.js": `
import React, { useState } from "react";
import CartDrawer from "./components/CartDrawer.js";
const STORE_CONFIG = { freeShippingThreshold: 200, currency: "$", taxRate: 0.08 };

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  return <CartDrawer isOpen={isOpen} storeConfig={STORE_CONFIG} />;
}
`,
      "/components/CartDrawer.js": hardened.code,
    };

    const runtimeResult = await verifyProjectRuntime(fixedFiles);
    assert.strictEqual(runtimeResult.valid, true, "Hardened component must render cleanly in active state");
    assert.strictEqual(runtimeResult.errors.length, 0);
  });

  // Test 4: Mismatched prop name detection (config vs storeConfig)
  test("4. Flags mismatched prop name when parent passes 'config' but child expects 'storeConfig'", () => {
    const mismatchedFiles = {
      "/App.js": `
import React from "react";
import CartDrawer from "./components/CartDrawer.js";

export default function App() {
  const storeConfig = { freeShippingThreshold: 150 };
  return (
    <div>
      <CartDrawer isOpen={false} config={storeConfig} />
    </div>
  );
}
`,
      "/components/CartDrawer.js": `
import React from "react";

export default function CartDrawer({ isOpen, storeConfig }) {
  if (!isOpen) return null;
  return <div>{storeConfig.freeShippingThreshold}</div>;
}
`,
    };

    const result = validatePropContracts(mismatchedFiles);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].type, "prop_contract_mismatch");
    assert.ok(
      result.errors[0].message.includes("config") && result.errors[0].message.includes("storeConfig"),
      `Must identify both expected 'storeConfig' and passed mismatched 'config': ${result.errors[0].message}`
    );
  });

  // Test 5: Prop contract validation on other components (Navbar, ProductGrid)
  test("5. Validates prop contracts across multiple components (Navbar categories, ProductGrid products)", () => {
    const projectFiles = {
      "/App.js": `
import React from "react";
import Navbar from "./components/Navbar.js";
import ProductGrid from "./components/ProductGrid.js";

export default function App() {
  return (
    <div>
      <Navbar />
      <ProductGrid />
    </div>
  );
}
`,
      "/components/Navbar.js": `
import React from "react";

export default function Navbar({ categories }) {
  return (
    <nav>
      {categories.map((c) => <span key={c}>{c}</span>)}
    </nav>
  );
}
`,
      "/components/ProductGrid.js": `
import React from "react";

export default function ProductGrid({ products }) {
  return (
    <div>
      {products.map((p) => <div key={p.id}>{p.name}</div>)}
    </div>
  );
}
`,
    };

    const result = validatePropContracts(projectFiles);
    assert.strictEqual(result.errors.length, 2, "Must flag missing 'categories' and 'products'");
    const navbarError = result.errors.find((e) => e.component === "Navbar");
    const gridError = result.errors.find((e) => e.component === "ProductGrid");

    assert.ok(navbarError, "Must flag Navbar missing categories");
    assert.strictEqual(navbarError.prop, "categories");
    assert.ok(gridError, "Must flag ProductGrid missing products");
    assert.strictEqual(gridError.prop, "products");
  });

  // Test 6: Multi-category compliant projects pass both contract and runtime verification
  test("6. Multi-category projects with compliant contracts pass validation and active runtime smoke tests", async () => {
    // A. E-Commerce
    const ecommerceFiles = {
      "/App.js": `
import React, { useState } from "react";
import CartDrawer from "./components/CartDrawer.js";
import ProductGrid from "./components/ProductGrid.js";

const STORE_CONFIG = { freeShippingThreshold: 200, currency: "$" };
const PRODUCTS = [{ id: 1, name: "Ceramic Mug", price: 34 }];

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState([]);
  return (
    <div>
      <ProductGrid products={PRODUCTS} />
      <CartDrawer isOpen={isOpen} cart={cart} storeConfig={STORE_CONFIG} />
    </div>
  );
}
`,
      "/components/CartDrawer.js": `
import React from "react";
export default function CartDrawer({ isOpen = false, cart = [], storeConfig = { freeShippingThreshold: 200 } }) {
  if (!isOpen) return null;
  return <div>Threshold: {storeConfig.freeShippingThreshold}</div>;
}
`,
      "/components/ProductGrid.js": `
import React from "react";
export default function ProductGrid({ products = [] }) {
  return <div>{products.map(p => <div key={p.id}>{p.name}</div>)}</div>;
}
`,
    };

    const ecomContract = validateProject(ecommerceFiles);
    assert.strictEqual(ecomContract.valid, true, "Compliant e-commerce must pass static validation");
    const ecomRuntime = await verifyProjectRuntime(ecommerceFiles);
    assert.strictEqual(ecomRuntime.valid, true, "Compliant e-commerce must pass active runtime verification");

    // B. Restaurant
    const restaurantFiles = {
      "/App.js": `
import React, { useState } from "react";
import MenuList from "./components/MenuList.js";
import ReservationModal from "./components/ReservationModal.js";

const MENU = [{ id: 101, name: "Truffle Pasta", price: 28 }];

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <MenuList items={MENU} />
      <ReservationModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
`,
      "/components/MenuList.js": `
import React from "react";
export default function MenuList({ items = [] }) {
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
`,
      "/components/ReservationModal.js": `
import React from "react";
export default function ReservationModal({ isOpen = false, onClose = () => {} }) {
  if (!isOpen) return null;
  return <div role="dialog"><button onClick={onClose}>Close</button></div>;
}
`,
    };

    const restContract = validateProject(restaurantFiles);
    assert.strictEqual(restContract.valid, true, "Compliant restaurant must pass static validation");
    const restRuntime = await verifyProjectRuntime(restaurantFiles);
    assert.strictEqual(restRuntime.valid, true, "Compliant restaurant must pass active runtime verification");
  });
});

