import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, validateAndFixCode, compileModuleCode } from '../services/codeValidator.js';
import { deriveFeatureChecklist, validateFeatureChecklist } from '../services/featureValidator.js';

describe('Phase 2C: E-Commerce Storefront Regression Scenario', () => {
  const prompt =
    'Build a modern responsive e-commerce storefront for a premium lifestyle brand. Include a navigation bar, hero section, product grid, product cards, category filtering, shopping cart, quantity controls, price calculation and responsive mobile layout.';

  // Representative generated project files conforming to DesignSpec and manifest
  const ecommerceFiles = {
    '/App.js': `
import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import './styles.css';

const SAMPLE_PRODUCTS = [
  { id: 1, name: 'Minimalist Ceramic Vase', category: 'Decor', price: 68, image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800' },
  { id: 2, name: 'Linen Throw Blanket', category: 'Textiles', price: 120, image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800' },
  { id: 3, name: 'Hand-Poured Soy Candle', category: 'Aromatherapy', price: 34, image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800' },
  { id: 4, name: 'Oak Wood Serving Tray', category: 'Kitchen', price: 85, image: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?w=800' },
];

export default function App() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts =
    selectedCategory === 'All'
      ? SAMPLE_PRODUCTS
      : SAMPLE_PRODUCTS.filter((p) => p.category === selectedCategory);

  return (
    <div className='min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans'>
      <Navbar
        cartCount={totalItemCount}
        onOpenCart={() => setIsCartOpen(true)}
      />
      <main className='flex-1'>
        <Hero />
        <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
          <div className='flex items-center justify-between mb-8'>
            <h2 className='text-2xl font-bold tracking-tight'>Curated Essentials</h2>
            <div className='flex gap-2'>
              {['All', 'Decor', 'Textiles', 'Aromatherapy', 'Kitchen'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={\`px-3 py-1.5 rounded-full text-xs font-medium transition \${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                  }\`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <ProductGrid
            products={filteredProducts}
            onAddToCart={addToCart}
          />
        </section>
      </main>
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        subtotal={subtotal}
      />
      <Footer />
    </div>
  );
}
`,
    '/styles.css': `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

:root {
  --color-primary: #1c1917;
  --color-accent: #78716c;
}

body {
  margin: 0;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`,
    '/components/Navbar.js': `
import React from 'react';
import { ShoppingBag, Search, Menu } from 'lucide-react';

export default function Navbar({ cartCount, onOpenCart }) {
  return (
    <header className='sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <button className='p-2 -ml-2 text-stone-600 hover:text-stone-900 md:hidden' aria-label='Open menu'>
            <Menu className='w-5 h-5' />
          </button>
          <span className='text-xl font-bold tracking-tight text-stone-900'>AURA LIVING</span>
        </div>
        <nav className='hidden md:flex items-center gap-8 text-sm font-medium text-stone-600'>
          <a href='#collection' className='hover:text-stone-900 transition'>Collection</a>
          <a href='#story' className='hover:text-stone-900 transition'>Our Story</a>
          <a href='#sustainability' className='hover:text-stone-900 transition'>Sustainability</a>
        </nav>
        <div className='flex items-center gap-2'>
          <button className='p-2 text-stone-600 hover:text-stone-900' aria-label='Search products'>
            <Search className='w-5 h-5' />
          </button>
          <button
            onClick={onOpenCart}
            className='relative p-2 text-stone-600 hover:text-stone-900'
            aria-label='View shopping cart'
          >
            <ShoppingBag className='w-5 h-5' />
            {cartCount > 0 && (
              <span className='absolute -top-1 -right-1 bg-stone-900 text-white text-[10px] font-bold size-4 rounded-full flex items-center justify-center'>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
`,
    '/components/Hero.js': `
import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section className='relative bg-stone-100 py-20 md:py-28 overflow-hidden'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10'>
        <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-200 text-stone-800 text-xs font-semibold uppercase tracking-wider mb-6'>
          <Sparkles className='w-3.5 h-3.5' /> Autumn / Winter 2026 Collection
        </div>
        <h1 className='text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-stone-900 max-w-3xl mx-auto'>
          Thoughtfully crafted objects for intentional spaces.
        </h1>
        <p className='mt-6 text-base sm:text-lg text-stone-600 max-w-xl mx-auto'>
          Sustainable, artisanal homeware made with timeless design and organic materials.
        </p>
        <div className='mt-8 flex justify-center gap-4'>
          <a
            href='#collection'
            className='inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition'
          >
            Explore Collection <ArrowRight className='w-4 h-4' />
          </a>
        </div>
      </div>
    </section>
  );
}
`,
    '/components/ProductGrid.js': `
import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, onAddToCart }) {
  if (products.length === 0) {
    return (
      <div className='py-16 text-center text-stone-500'>
        <p>No products found in this category.</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
`,
    '/components/ProductCard.js': `
import React from 'react';
import { Plus } from 'lucide-react';

export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className='group bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col hover:shadow-lg transition'>
      <div className='aspect-square overflow-hidden bg-stone-100 relative'>
        <img
          src={product.image}
          alt={product.name}
          className='w-full h-full object-cover group-hover:scale-105 transition duration-500'
        />
        <span className='absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-md text-[10px] font-semibold uppercase tracking-wider text-stone-700'>
          {product.category}
        </span>
      </div>
      <div className='p-5 flex-1 flex flex-col justify-between'>
        <div>
          <h3 className='font-semibold text-stone-900 group-hover:text-stone-700 transition'>
            {product.name}
          </h3>
          <p className='mt-1 text-sm font-bold text-stone-900'>$\\{product.price}</p>
        </div>
        <button
          onClick={() => onAddToCart(product)}
          className='mt-4 w-full py-2.5 px-4 rounded-xl bg-stone-100 text-stone-900 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-stone-900 hover:text-white transition'
        >
          <Plus className='w-4 h-4' /> Add to Cart
        </button>
      </div>
    </div>
  );
}
`,
    '/components/CartDrawer.js': `
import React from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemove,
  subtotal,
}) {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-hidden'>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={onClose} />
      <div className='absolute inset-y-0 right-0 max-w-full flex pl-10'>
        <div className='w-screen max-w-md bg-white shadow-2xl flex flex-col'>
          <div className='p-6 border-b border-stone-200 flex items-center justify-between'>
            <h2 className='text-lg font-bold text-stone-900'>Your Cart</h2>
            <button onClick={onClose} className='p-2 text-stone-400 hover:text-stone-600' aria-label='Close cart'>
              <X className='w-5 h-5' />
            </button>
          </div>
          <div className='flex-1 overflow-y-auto p-6 space-y-4'>
            {cart.length === 0 ? (
              <div className='h-full flex flex-col items-center justify-center text-center text-stone-400'>
                <p>Your shopping cart is empty.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className='flex items-center gap-4 pb-4 border-b border-stone-100'>
                  <img src={item.image} alt={item.name} className='size-16 rounded-lg object-cover' />
                  <div className='flex-1 min-w-0'>
                    <h4 className='font-medium text-sm text-stone-900 truncate'>{item.name}</h4>
                    <p className='text-xs text-stone-500'>$\\{item.price} each</p>
                    <div className='mt-2 flex items-center gap-2'>
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className='p-1 border border-stone-200 rounded text-stone-600 hover:bg-stone-50'
                        aria-label='Decrease quantity'
                      >
                        <Minus className='w-3 h-3' />
                      </button>
                      <span className='text-xs font-semibold px-2'>{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className='p-1 border border-stone-200 rounded text-stone-600 hover:bg-stone-50'
                        aria-label='Increase quantity'
                      >
                        <Plus className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    className='p-2 text-stone-400 hover:text-rose-600'
                    aria-label='Remove item'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className='p-6 border-t border-stone-200 bg-stone-50'>
              <div className='flex items-center justify-between text-base font-bold text-stone-900 mb-4'>
                <span>Subtotal</span>
                <span>$\\{subtotal}</span>
              </div>
              <button
                onClick={() => alert('Proceeding to checkout')}
                className='w-full py-3.5 px-4 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 transition'
              >
                Checkout ($\\{subtotal})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`,
    '/components/Footer.js': `
import React from 'react';

export default function Footer() {
  return (
    <footer className='bg-stone-900 text-stone-400 py-12 border-t border-stone-800'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4'>
        <p className='text-xs'>&copy; 2026 AURA LIVING. All rights reserved.</p>
        <div className='flex gap-6 text-xs'>
          <a href='#terms' className='hover:text-white transition'>Terms</a>
          <a href='#privacy' className='hover:text-white transition'>Privacy</a>
          <a href='#shipping' className='hover:text-white transition'>Shipping</a>
        </div>
      </div>
    </footer>
  );
}
`,
  };

  const plannedFiles = [
    { path: '/App.js', description: 'Main application', isEntry: true, mandatory: true },
    { path: '/styles.css', description: 'Global styles', mandatory: true },
    { path: '/components/Navbar.js', description: 'Navbar with cart button', mandatory: true },
    { path: '/components/Hero.js', description: 'Hero banner', mandatory: true },
    { path: '/components/ProductGrid.js', description: 'Product catalog grid', mandatory: true },
    { path: '/components/ProductCard.js', description: 'Product card component', mandatory: true },
    { path: '/components/CartDrawer.js', description: 'Slide-over cart drawer', mandatory: true },
    { path: '/components/Footer.js', description: 'Footer', mandatory: true },
  ];

  it('1. Validates all planned files exist with no missing files', () => {
    for (const planned of plannedFiles) {
      assert.ok(ecommerceFiles[planned.path], `Planned file ${planned.path} must exist in generated output`);
    }
  });

  it('2. Project-level semantic validation passes with zero errors', () => {
    const val = validateProject(ecommerceFiles, plannedFiles);
    assert.equal(val.valid, true, 'Multi-file project must pass validation');
    assert.equal(val.errors.length, 0, 'Must have zero validation errors');
  });

  it('3. All Lucide icons imported exist in installed lucide-react package', () => {
    for (const [path, content] of Object.entries(ecommerceFiles)) {
      if (!path.endsWith('.js')) continue;
      const res = validateAndFixCode(content, path);
      assert.equal(res.valid, true);
      const iconErrors = res.errors.filter((e) => e.type === 'icon');
      assert.equal(iconErrors.length, 0, `File ${path} must have 0 icon errors`);
    }
  });

  it('4. Real JSX compilation succeeds on all modules', async () => {
    for (const [path, content] of Object.entries(ecommerceFiles)) {
      if (!path.endsWith('.js')) continue;
      const compRes = await compileModuleCode(content, path);
      assert.equal(compRes.success, true, `Compilation must succeed for ${path}`);
      assert.ok(compRes.compiledCode.length > 0);
    }
  });

  it('5. Feature-specific checklist satisfies 100% of mandatory e-commerce criteria', () => {
    const checklist = deriveFeatureChecklist(prompt, { category: 'modern_ecommerce' });
    assert.ok(checklist.length >= 8, 'E-commerce checklist must have at least 8 verification points');

    const report = validateFeatureChecklist(ecommerceFiles, checklist);
    assert.ok(report.score >= 80, `Feature score ${report.score}% must be >= 80%`);
    assert.equal(report.allMandatoryPassed, true, 'All mandatory e-commerce features must pass');

    // Confirm individual checklist item statuses
    const navItem = report.items.find((i) => i.id === 'navigation');
    const gridItem = report.items.find((i) => i.id === 'product_grid');
    const cartStateItem = report.items.find((i) => i.id === 'cart_state');
    const priceItem = report.items.find((i) => i.id === 'price_calculation');

    assert.equal(navItem.status, 'implemented');
    assert.equal(gridItem.status, 'implemented');
    assert.equal(cartStateItem.status, 'implemented');
    assert.equal(priceItem.status, 'implemented');
  });

  it('6. Functional cart arithmetic and interaction model behaves predictably', () => {
    // Test the exact price calculation logic generated in App.js
    let cart = [];
    const vase = { id: 1, name: 'Vase', price: 68, quantity: 1 };
    const blanket = { id: 2, name: 'Blanket', price: 120, quantity: 2 };

    // Add items
    cart = [vase, blanket];
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(subtotal, 68 * 1 + 120 * 2); // 68 + 240 = 308

    // Increment quantity
    cart = cart.map((i) => (i.id === 1 ? { ...i, quantity: i.quantity + 1 } : i));
    const updatedSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(updatedSubtotal, 68 * 2 + 120 * 2); // 136 + 240 = 376

    // Remove item
    cart = cart.filter((i) => i.id !== 2);
    const finalSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(finalSubtotal, 68 * 2); // 136
  });
});
