/**
 * Feature-specific requirement analyzer and validation checklist.
 * Derives a dynamic feature checklist from the project prompt / DesignSpec,
 * then validates that the generated React code actually contains the required
 * state hooks, event handlers, UI components, and responsive interactions.
 */

export function deriveFeatureChecklist(prompt = "", designSpec = null) {
  const p = prompt.toLowerCase();
  const category = designSpec?.category || "";

  // 1. E-Commerce Storefront
  const isEcommerce =
    category === "ecommerce" ||
    category === "modern_ecommerce" ||
    /\b(ecommerce|e-commerce|store|shop|storefront|cart|checkout|products?)\b/i.test(p);

  if (isEcommerce) {
    return [
      {
        id: "navigation",
        name: "Navigation Bar with Cart Indicator",
        description: "Navbar with branding, navigation links, and cart toggle",
        mandatory: true,
        patterns: [/<nav\b|<header\b/i, /ShoppingCart|ShoppingBag|Menu/i],
      },
      {
        id: "product_grid",
        name: "Product Catalog Grid",
        description: "Grid or list rendering catalog products dynamically",
        mandatory: true,
        patterns: [/\.map\s*\(/i, /grid-cols/i, /products?|items?/i],
      },
      {
        id: "product_card",
        name: "Product Card Component",
        description: "Product card displaying image, title, price, and action button",
        mandatory: true,
        patterns: [/price|\$|usd/i, /<button\b/i, /card|rounded/i],
      },
      {
        id: "cart_state",
        name: "Shopping Cart State Management",
        description: "React state managing cart items, quantities, or cart visibility",
        mandatory: true,
        patterns: [/useState/i, /cart|cartItems|shoppingCart/i],
      },
      {
        id: "add_to_cart",
        name: "Add-to-Cart Functionality",
        description: "Click handler to add products to the active cart",
        mandatory: true,
        patterns: [/addToCart|setCart|addItem|handleAddToCart/i, /<button/i],
      },
      {
        id: "quantity_controls",
        name: "Cart Quantity Controls & Item Removal",
        description: "Controls to increment, decrement, or remove items from the cart",
        mandatory: true,
        patterns: [/quantity/i, /removeFromCart|updateQuantity|decrement|increment|\+|-|trash/i],
      },
      {
        id: "price_calculation",
        name: "Cart Price Calculation",
        description: "Mathematical computation of subtotal, tax, or total amount",
        mandatory: true,
        patterns: [/\.reduce\s*\(|subtotal|total/i, /\*\s*(?:item\.)?quantity/i],
      },
      {
        id: "responsive_layout",
        name: "Responsive Mobile/Desktop Layout",
        description: "Mobile-first grid and flex responsive breakpoints",
        mandatory: true,
        patterns: [/md:|sm:|lg:/i, /grid-cols-1/i],
      },
    ];
  }

  // 2. Portfolio / Agency
  const isPortfolio =
    category === "agency_portfolio" ||
    category === "personal_brand" ||
    /\b(portfolio|agency|showcase|works?|projects?)\b/i.test(p);

  if (isPortfolio) {
    return [
      {
        id: "navigation",
        name: "Navigation Header",
        description: "Header navigation with brand name and links",
        mandatory: true,
        patterns: [/<nav\b/i, /<header\b/i],
      },
      {
        id: "hero",
        name: "Hero Introduction",
        description: "Impactful hero section presenting identity and statement",
        mandatory: true,
        patterns: [/<h1\b/i, /hero|intro/i],
      },
      {
        id: "project_gallery",
        name: "Project / Works Gallery",
        description: "Showcase grid of works or case studies",
        mandatory: true,
        patterns: [/\.map\s*\(/i, /project|work|case/i],
      },
      {
        id: "contact_section",
        name: "Contact / Inquiry Section",
        description: "Contact form, email trigger, or social links",
        mandatory: true,
        patterns: [/contact|email|message|form/i],
      },
      {
        id: "responsive_layout",
        name: "Responsive Layout",
        description: "Mobile and desktop responsive styling",
        mandatory: true,
        patterns: [/md:|sm:|lg:/i],
      },
    ];
  }

  // 3. SaaS / Product Landing
  const isSaaS =
    category === "saas_landing" ||
    /\b(saas|software|platform|pricing|features?|app)\b/i.test(p);

  if (isSaaS) {
    return [
      {
        id: "navigation",
        name: "Header Navigation",
        description: "Navigation with product links and CTA",
        mandatory: true,
        patterns: [/<nav\b/i, /<header\b/i],
      },
      {
        id: "hero",
        name: "Hero Section with CTA",
        description: "Value proposition headline and primary CTA",
        mandatory: true,
        patterns: [/<h1\b/i, /<button\b/i],
      },
      {
        id: "feature_grid",
        name: "Feature Showcase",
        description: "Key features or value pillars",
        mandatory: true,
        patterns: [/feature|benefit|capability/i, /\.map\s*\(|grid/i],
      },
      {
        id: "cta_or_pricing",
        name: "Call-to-Action or Pricing",
        description: "Clear next action or tier options",
        mandatory: true,
        patterns: [/pricing|get started|sign up|cta|tier/i],
      },
      {
        id: "responsive_layout",
        name: "Responsive Layout",
        description: "Mobile and desktop responsive styling",
        mandatory: true,
        patterns: [/md:|sm:|lg:/i],
      },
    ];
  }

  // 4. General Default
  return [
    {
      id: "navigation",
      name: "Header Navigation",
      description: "Header navigation with brand name",
      mandatory: true,
      patterns: [/<nav\b/i, /<header\b/i],
    },
    {
      id: "hero_or_header",
      name: "Primary Header / Hero",
      description: "Main heading introducing the page",
      mandatory: true,
      patterns: [/<h1\b/i],
    },
    {
      id: "content_section",
      name: "Main Content Section",
      description: "Core content or interactive components",
      mandatory: true,
      patterns: [/<main\b|section|article/i],
    },
    {
      id: "responsive_layout",
      name: "Responsive Layout",
      description: "Responsive styling for mobile and desktop",
      mandatory: true,
      patterns: [/md:|sm:|lg:/i],
    },
  ];
}

/**
 * Validates generated project files against a derived feature checklist.
 * Returns structured results with status per feature:
 * "implemented" | "partially_implemented" | "unverified"
 */
export function validateFeatureChecklist(files = {}, checklist = []) {
  if (!checklist || checklist.length === 0) {
    return {
      items: [],
      score: 100,
      allMandatoryPassed: true,
    };
  }

  // Combine code from all JS/JSX files
  const combinedCode = Object.entries(files)
    .filter(([path]) => path.endsWith(".js") || path.endsWith(".jsx"))
    .map(([path, data]) => {
      const content = typeof data === "string" ? data : data?.content || "";
      return `/* ${path} */\n${content}`;
    })
    .join("\n\n");

  const results = [];
  let passedCount = 0;
  let allMandatoryPassed = true;

  for (const item of checklist) {
    const matchedPatterns = item.patterns.filter((pat) => pat.test(combinedCode));
    const matchRatio = matchedPatterns.length / item.patterns.length;

    let status = "unverified";
    let evidence = "No matching code patterns found.";

    if (matchRatio >= 0.75) {
      status = "implemented";
      evidence = `Found strong evidence (${matchedPatterns.length}/${item.patterns.length} pattern matches).`;
      passedCount += 1;
    } else if (matchRatio > 0) {
      status = "partially_implemented";
      evidence = `Found partial evidence (${matchedPatterns.length}/${item.patterns.length} pattern matches).`;
      passedCount += 0.5;
    } else {
      status = "unverified";
      evidence = `Missing required patterns for feature '${item.name}'.`;
      if (item.mandatory) {
        allMandatoryPassed = false;
      }
    }

    results.push({
      id: item.id,
      name: item.name,
      description: item.description,
      mandatory: item.mandatory,
      status,
      evidence,
      matchedPatterns: matchedPatterns.length,
      totalPatterns: item.patterns.length,
    });
  }

  const score = Math.round((passedCount / checklist.length) * 100);

  return {
    items: results,
    score,
    allMandatoryPassed,
  };
}
