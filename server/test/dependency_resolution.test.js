import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateProjectDependencies,
  validateProject,
  isValidNpmPackageName,
  isValidSemverSpec,
  DEFAULT_PACKAGE_VERSIONS,
  FORBIDDEN_CLIENT_MODULES,
  SUPPORTED_PACKAGES,
} from "../services/codeValidator.js";

// Client-side dependency utility verification
import {
  detectDependencies,
  isValidNpmPackageName as clientIsValidNpmPackageName,
  validateDependenciesMap,
} from "../../client/src/utils/sandpackUtils.js";

describe("Sandpack Dependency Preflight & Resolution Engine", () => {
  describe("Package Name & Version Validation Primitives", () => {
    it("1. Validates standard, scoped, and unscoped npm package names", () => {
      assert.strictEqual(isValidNpmPackageName("lucide-react"), true);
      assert.strictEqual(isValidNpmPackageName("@codesandbox/sandpack-react"), true);
      assert.strictEqual(isValidNpmPackageName("canvas-confetti"), true);
      assert.strictEqual(isValidNpmPackageName("framer-motion"), true);
      assert.strictEqual(isValidNpmPackageName("recharts"), true);
      assert.strictEqual(isValidNpmPackageName("clsx"), true);
    });

    it("2. Rejects invalid npm package names (uppercase, leading dots/underscores, forbidden chars)", () => {
      assert.strictEqual(isValidNpmPackageName("Invalid_Capital_Pkg"), false);
      assert.strictEqual(isValidNpmPackageName(".hidden-package"), false);
      assert.strictEqual(isValidNpmPackageName("_private-pkg"), false);
      assert.strictEqual(isValidNpmPackageName("pkg with spaces"), false);
      assert.strictEqual(isValidNpmPackageName("pkg@version"), false);
      assert.strictEqual(isValidNpmPackageName(""), false);
      assert.strictEqual(isValidNpmPackageName(null), false);
    });

    it("3. Rejects forbidden Node.js built-ins and server packages", () => {
      for (const mod of ["fs", "path", "child_process", "os", "crypto", "express", "mongoose"]) {
        assert.strictEqual(isValidNpmPackageName(mod), false, `Module '${mod}' must be rejected`);
      }
    });

    it("4. Validates semver version specifications and ranges", () => {
      assert.strictEqual(isValidSemverSpec("^18.3.1"), true);
      assert.strictEqual(isValidSemverSpec("~0.469.0"), true);
      assert.strictEqual(isValidSemverSpec("1.0.0"), true);
      assert.strictEqual(isValidSemverSpec(">=16.8.0"), true);
      assert.strictEqual(isValidSemverSpec("latest"), true);
      assert.strictEqual(isValidSemverSpec("*"), true);
    });

    it("5. Rejects malformed semver strings", () => {
      assert.strictEqual(isValidSemverSpec("1.2.3.4.5"), false);
      assert.strictEqual(isValidSemverSpec("invalid-semver"), false);
      assert.strictEqual(isValidSemverSpec("foo@@bar"), false);
      assert.strictEqual(isValidSemverSpec(""), false);
      assert.strictEqual(isValidSemverSpec(null), false);
    });
  });

  describe("Template Literal False-Positive Prevention (The Observability SDK Bug)", () => {
    it("6. Ignores mock import statements inside string template literals (LiveTelemetryPlayground scenario)", () => {
      // Replicating the exact content from the DB project 6ae62dd399a840eebac298fd
      const telemetryCode = `
import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

const SNIPPETS = {
  python: \`import os
from synapsellm import monitor

monitor.init(api_key=os.getenv("SYNAPSE_KEY"))\`,
  typescript: \`import { SynapseLLM, Guardrails } from '@synapsellm/sdk';

const synapse = new SynapseLLM({ apiKey: process.env.SYNAPSE_KEY });\`,
  curl: \`curl -X POST https://api.synapsellm.ai/v1/telemetry \\\\
  -H "Authorization: Bearer \$API_KEY"\`
};

export default function LiveTelemetryPlayground() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-4 bg-slate-900 text-white rounded">
      <Terminal className="w-5 h-5 text-indigo-400" />
      <pre>{SNIPPETS.typescript}</pre>
    </div>
  );
}
`;

      const files = {
        "/App.js": `
import React from 'react';
import LiveTelemetryPlayground from './components/LiveTelemetryPlayground';
export default function App() { return <LiveTelemetryPlayground />; }
`,
        "/components/LiveTelemetryPlayground.js": telemetryCode,
      };

      const result = validateProjectDependencies(files);

      // Must succeed without reporting @synapsellm/sdk as an undeclared or invalid package
      assert.strictEqual(result.errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(result.errors)}`);

      // Synthesized package.json must contain lucide-react and react, but NOT @synapsellm/sdk
      assert.ok(files["/package.json"], "package.json must be synthesized");
      const pkg = JSON.parse(files["/package.json"]);
      assert.strictEqual(pkg.dependencies["@synapsellm/sdk"], undefined);
      assert.ok(pkg.dependencies["lucide-react"]);
      assert.ok(pkg.dependencies.react);
    });

    it("7. Client detectDependencies also ignores mock imports in template literals", () => {
      const files = {
        "/components/LiveTelemetryPlayground.js": `
import React from 'react';
import { Play } from 'lucide-react';
const code = \`import { fakeModule } from '@nonexistent/fictional-package';\`;
export default function Comp() { return <Play />; }
`,
      };

      const deps = detectDependencies(files);
      assert.strictEqual(deps["@nonexistent/fictional-package"], undefined);
      assert.strictEqual(deps["lucide-react"], DEFAULT_PACKAGE_VERSIONS["lucide-react"]);
      assert.strictEqual(deps.react, DEFAULT_PACKAGE_VERSIONS.react);
    });
  });

  describe("Canonical package.json Auto-Synthesis & Pinned Versions", () => {
    it("8. Synthesizes canonical /package.json with pinned versions when missing", () => {
      const files = {
        "/App.js": `
import React from 'react';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
export default function App() { return <div><Activity /></div>; }
`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(files);
      assert.strictEqual(val.valid, true);

      assert.ok(files["/package.json"], "Must auto-synthesize /package.json");
      const pkg = JSON.parse(files["/package.json"]);
      assert.strictEqual(pkg.dependencies.react, "^18.3.1");
      assert.strictEqual(pkg.dependencies["react-dom"], "^18.3.1");
      assert.strictEqual(pkg.dependencies["lucide-react"], "^0.469.0");
      assert.strictEqual(pkg.dependencies["framer-motion"], "^11.15.0");
      assert.strictEqual(pkg.dependencies["canvas-confetti"], "^1.9.3");
    });

    it("9. Normalizes 'latest' to pinned versions to prevent CodeSandbox 403 cache misses", () => {
      const files = {
        "/App.js": `
import React from 'react';
import { Star } from 'lucide-react';
export default function App() { return <Star />; }
`,
        "/package.json": JSON.stringify({
          dependencies: {
            "react": "latest",
            "react-dom": "latest",
            "lucide-react": "latest",
          },
        }),
      };

      const res = validateProjectDependencies(files);
      assert.strictEqual(res.errors.length, 0);

      const pkg = JSON.parse(files["/package.json"]);
      assert.strictEqual(pkg.dependencies.react, "^18.3.1");
      assert.strictEqual(pkg.dependencies["react-dom"], "^18.3.1");
      assert.strictEqual(pkg.dependencies["lucide-react"], "^0.469.0");
      assert.ok(res.warnings.some((w) => w.includes("Normalized 'lucide-react' version from 'latest' to pinned")));
    });

    it("10. Detects malformed /package.json syntax", () => {
      const files = {
        "/App.js": "import React from 'react'; export default function App() { return null; }",
        "/package.json": "{ invalid json content: 123, }",
      };

      const res = validateProjectDependencies(files);
      assert.ok(res.errors.some((e) => e.type === "dependency_invalid_syntax"));
    });
  });

  describe("Error Detection & Diagnostics", () => {
    it("11. Rejects forbidden Node.js modules imported in client components", () => {
      const files = {
        "/App.js": `
import React from 'react';
import fs from 'fs';
export default function App() { return null; }
`,
      };

      const res = validateProjectDependencies(files);
      assert.ok(res.errors.some((e) => e.type === "dependency_forbidden" && e.message.includes("fs")));
    });

    it("12. Flags undeclared and unsupported external packages", () => {
      const files = {
        "/App.js": `
import React from 'react';
import { someHelper } from 'invented-unsupported-lib-xyz';
export default function App() { return <div>{someHelper()}</div>; }
`,
        "/package.json": JSON.stringify({
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
          },
        }),
      };

      const res = validateProjectDependencies(files);
      assert.ok(res.errors.some((e) => e.type === "dependency_undeclared"));
    });

    it("13. Flags invalid semver version specifications in package.json", () => {
      const files = {
        "/App.js": "import React from 'react'; export default function App() { return null; }",
        "/package.json": JSON.stringify({
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "lucide-react": "not_a_valid_semver_12345!!!",
          },
        }),
      };

      const res = validateProjectDependencies(files);
      assert.ok(res.errors.some((e) => e.type === "dependency_invalid_version"));
    });
  });

  describe("Client-Side Sandpack Utilities Compatibility", () => {
    it("14. detectDependencies processes both plain string code and object { content } format", () => {
      const filesWithString = {
        "/App.js": "import React from 'react'; import { Heart } from 'lucide-react'; export default function App() { return <Heart />; }",
      };

      const filesWithObject = {
        "/App.js": {
          content: "import React from 'react'; import { Heart } from 'lucide-react'; export default function App() { return <Heart />; }",
        },
      };

      const depsStr = detectDependencies(filesWithString);
      const depsObj = detectDependencies(filesWithObject);

      assert.strictEqual(depsStr["lucide-react"], "^0.469.0");
      assert.strictEqual(depsObj["lucide-react"], "^0.469.0");
      assert.deepStrictEqual(depsStr, depsObj);
    });

    it("15. validateDependenciesMap flags forbidden or invalid packages and warns on unpinned latest", () => {
      const rawDeps = {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "latest",
        "fs": "^1.0.0",
        "@synapsellm/sdk": "latest",
        "INVALID_CAPITAL": "^1.0.0",
      };

      const result = validateDependenciesMap(rawDeps);
      assert.strictEqual(result.valid, false);

      const errPackages = result.errors.map((e) => e.package);
      assert.ok(errPackages.includes("fs"), "fs must be flagged as forbidden error");
      assert.ok(errPackages.includes("INVALID_CAPITAL"), "INVALID_CAPITAL must be flagged as invalid name error");

      assert.ok(result.warnings.some((w) => w.includes("lucide-react") && w.includes("latest")));
    });
  });

  describe("Real-World Acceptance Testing Across 5 Distinct Project Types", () => {
    it("16. AI Developer Observability Platform (exact DB project 6ae62dd399a840eebac298fd)", () => {
      const observabilityFiles = {
        "/App.js": `
import React from 'react';
import LiveTelemetryPlayground from './components/LiveTelemetryPlayground';
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <LiveTelemetryPlayground />
    </div>
  );
}
`,
        "/components/LiveTelemetryPlayground.js": `
import React, { useState } from 'react';
import { Terminal } from 'lucide-react';

const SNIPPETS = {
  python: \`import os
from synapsellm import monitor
monitor.init(api_key=os.getenv("SYNAPSE_KEY"))\`,
  typescript: \`import { SynapseLLM, Guardrails } from '@synapsellm/sdk';
const synapse = new SynapseLLM({ apiKey: process.env.SYNAPSE_KEY });\`
};

export default function LiveTelemetryPlayground() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2"><Terminal className="w-5 h-5 text-indigo-400" /> Playground</div>
      <pre>{SNIPPETS.typescript}</pre>
    </div>
  );
}
`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(observabilityFiles);
      assert.strictEqual(val.valid, true, "Observability project must pass validation");

      const clientDeps = detectDependencies(observabilityFiles);
      assert.strictEqual(clientDeps["@synapsellm/sdk"], undefined, "Must NOT extract fictional @synapsellm/sdk");
      assert.strictEqual(clientDeps["lucide-react"], "^0.469.0");
      assert.strictEqual(clientDeps.react, "^18.3.1");
      assert.strictEqual(clientDeps["react-dom"], "^18.3.1");
    });

    it("17. Luxury Ceramics E-commerce with cart drawer and pricing calculations", () => {
      const ceramicsFiles = {
        "/App.js": `
import React, { useState } from 'react';
import CartDrawer from './components/CartDrawer';
import ProductGrid from './components/ProductGrid';

const storeConfig = {
  freeShippingThreshold: 150,
  currency: 'USD',
  taxRate: 0.08
};

export default function App() {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-stone-50 text-stone-900">
      <ProductGrid onAddToCart={(item) => setCart([...cart, item])} />
      <CartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} cart={cart} storeConfig={storeConfig} />
    </div>
  );
}
`,
        "/components/ProductGrid.js": `
import React from 'react';
import { ShoppingBag } from 'lucide-react';
export default function ProductGrid({ onAddToCart }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button onClick={() => onAddToCart({ id: 1, name: 'Vase', price: 95 })}>
        <ShoppingBag className="w-4 h-4 mr-2" /> Add Vase
      </button>
    </div>
  );
}
`,
        "/components/CartDrawer.js": `
import React from 'react';
import { X } from 'lucide-react';
export default function CartDrawer({ isOpen, onClose, cart = [], storeConfig = { freeShippingThreshold: 150 } }) {
  if (!isOpen) return null;
  const threshold = storeConfig.freeShippingThreshold;
  const total = cart.reduce((acc, item) => acc + item.price, 0);
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white p-6 shadow-xl">
      <button onClick={onClose}><X className="w-5 h-5" /></button>
      <p>Spend \${threshold - total} more for free shipping!</p>
    </div>
  );
}
`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(ceramicsFiles);
      assert.strictEqual(val.valid, true, "Ceramics project must pass validation");

      const clientDeps = detectDependencies(ceramicsFiles);
      assert.strictEqual(clientDeps["lucide-react"], "^0.469.0");
      assert.strictEqual(clientDeps.react, "^18.3.1");
      assert.strictEqual(clientDeps["react-dom"], "^18.3.1");
    });

    it("18. Minimal Single-Page Landing Site", () => {
      const landingFiles = {
        "/App.js": `
import React from 'react';
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-800">Launch Your Vision</h1>
    </main>
  );
}
`,
        "/styles.css": "body { margin: 0; font-family: sans-serif; }",
      };

      const val = validateProject(landingFiles);
      assert.strictEqual(val.valid, true);

      const clientDeps = detectDependencies(landingFiles);
      assert.deepStrictEqual(clientDeps, {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      });
    });

    it("19. Lucide Icons Gallery with multiple modern icons", () => {
      const iconGalleryFiles = {
        "/App.js": `
import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Globe, Layers } from 'lucide-react';
export default function App() {
  return (
    <div className="grid grid-cols-3 gap-6 p-8">
      <Sparkles className="w-6 h-6 text-amber-500" />
      <ArrowRight className="w-6 h-6 text-blue-500" />
      <ShieldCheck className="w-6 h-6 text-emerald-500" />
      <Zap className="w-6 h-6 text-yellow-500" />
      <Globe className="w-6 h-6 text-cyan-500" />
      <Layers className="w-6 h-6 text-purple-500" />
    </div>
  );
}
`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(iconGalleryFiles);
      assert.strictEqual(val.valid, true);

      const clientDeps = detectDependencies(iconGalleryFiles);
      assert.strictEqual(clientDeps["lucide-react"], "^0.469.0");
    });

    it("20. Multi-dependency project with charts, animations, and confetti", () => {
      const multiDepFiles = {
        "/App.js": `
import React from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp } from 'lucide-react';

const data = [
  { name: 'Jan', val: 400 },
  { name: 'Feb', val: 700 },
  { name: 'Mar', val: 1200 },
];

export default function App() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-6 h-6 text-green-500" />
        <h2 className="text-2xl font-bold">Performance Analytics</h2>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="val" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
`,
        "/styles.css": "body { margin: 0; }",
      };

      const val = validateProject(multiDepFiles);
      assert.strictEqual(val.valid, true);

      const clientDeps = detectDependencies(multiDepFiles);
      assert.strictEqual(clientDeps["lucide-react"], "^0.469.0");
      assert.strictEqual(clientDeps["framer-motion"], "^11.15.0");
      assert.strictEqual(clientDeps["canvas-confetti"], "^1.9.3");
      assert.strictEqual(clientDeps["recharts"], "^2.15.0");
      assert.strictEqual(clientDeps["react"], "^18.3.1");
      assert.strictEqual(clientDeps["react-dom"], "^18.3.1");
    });
  });
});
