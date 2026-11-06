/**
 * Reusable Deterministic Website Fixtures for Stage 4 Browser Verification
 * Implements the four fixtures specified in PHASE_5_TEST_STRATEGY.md:
 * - Fixture A: Modern Portfolio Storefront
 * - Fixture B: SaaS Product Landing Page
 * - Fixture C: Searchable Dataset Directory
 * - Fixture D: Interactive E-Commerce Application with Cart
 */

// ----------------------------------------------------------------------------
// Fixture A: Modern Portfolio
// ----------------------------------------------------------------------------
export const portfolioFixture = {
  "/styles.css": `
    @import "tailwindcss";
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      overflow-x: hidden;
      background-color: #ffffff;
      color: #09090b;
    }
  `,
  "/App.js": `
    import React from 'react';
    import Navbar from './components/Navbar';
    import Hero from './components/Hero';
    import Projects from './components/Projects';
    import Skills from './components/Skills';
    import Contact from './components/Contact';
    import './styles.css';

    export default function App() {
      return (
        <div className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">
          <Navbar />
          <main>
            <Hero />
            <Projects />
            <Skills />
            <Contact />
          </main>
          <footer className="py-8 text-center text-sm text-zinc-500 border-t border-zinc-200">
            <p>© 2026 Modern Portfolio. All rights reserved.</p>
          </footer>
        </div>
      );
    }
  `,
  "/components/Navbar.js": `
    import React, { useState } from 'react';

    export default function Navbar() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-zinc-200 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-bold text-xl text-zinc-900">Modern Portfolio</span>
            <nav className="hidden md:flex space-x-6">
              <a href="#projects" id="nav-projects-link" className="text-zinc-600 hover:text-zinc-900 transition">Projects</a>
              <a href="#skills" id="nav-skills-link" className="text-zinc-600 hover:text-zinc-900 transition">Skills</a>
              <a href="#contact" id="nav-contact-link" className="text-zinc-600 hover:text-zinc-900 transition">Contact</a>
            </nav>
            <button
              id="mobile-menu-toggle"
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-zinc-600 hover:text-zinc-900 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          {isOpen && (
            <div id="mobile-menu" className="md:hidden bg-zinc-50 border-b border-zinc-200 px-4 py-4 space-y-3">
              <a
                href="#projects"
                onClick={() => setIsOpen(false)}
                className="block text-zinc-700 font-medium hover:text-zinc-900"
              >
                Projects
              </a>
              <a
                href="#skills"
                onClick={() => setIsOpen(false)}
                className="block text-zinc-700 font-medium hover:text-zinc-900"
              >
                Skills
              </a>
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="block text-zinc-700 font-medium hover:text-zinc-900"
              >
                Contact
              </a>
            </div>
          )}
        </header>
      );
    }
  `,
  "/components/Hero.js": `
    import React from 'react';

    export default function Hero() {
      return (
        <section id="hero" className="py-20 md:py-32 px-4 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-900 mb-6">
            Building Digital Products with Polish & Purpose
          </h1>
          <p className="text-lg md:text-xl text-zinc-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Senior Frontend Architect specializing in React, high-performance UI systems, and interactive experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#projects"
              id="hero-cta-btn"
              className="w-full sm:w-auto px-8 py-3.5 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition"
            >
              View Selected Works
            </a>
            <a
              href="#contact"
              className="w-full sm:w-auto px-8 py-3.5 border border-zinc-300 text-zinc-800 font-medium rounded-lg hover:bg-zinc-50 transition"
            >
              Get in Touch
            </a>
          </div>
        </section>
      );
    }
  `,
  "/components/Projects.js": `
    import React from 'react';

    const PROJECTS = [
      { id: 1, title: 'E-Commerce Platform', category: 'Web App', desc: 'Modern headless commerce engine.' },
      { id: 2, title: 'Analytics Dashboard', category: 'SaaS Tool', desc: 'Real-time telemetry and metrics.' },
      { id: 3, title: 'Design System', category: 'UI Kit', desc: 'Scalable token-based React library.' },
    ];

    export default function Projects() {
      return (
        <section id="projects" className="py-16 md:py-24 px-4 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-900 mb-8 text-center md:text-left">Selected Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PROJECTS.map((project) => (
              <div key={project.id} className="project-card p-6 border border-zinc-200 rounded-xl bg-white shadow-sm">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{project.category}</span>
                <h3 className="text-xl font-bold text-zinc-900 mt-2 mb-2">{project.title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{project.desc}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }
  `,
  "/components/Skills.js": `
    import React from 'react';

    const SKILLS = ['React 19', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Next.js', 'Vite', 'Architecture'];

    export default function Skills() {
      return (
        <section id="skills" className="py-16 px-4 max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-zinc-900 mb-8">Core Expertise</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {SKILLS.map((skill) => (
              <span key={skill} className="px-4 py-2 bg-zinc-100 text-zinc-800 rounded-full font-medium text-sm">
                {skill}
              </span>
            ))}
          </div>
        </section>
      );
    }
  `,
  "/components/Contact.js": `
    import React, { useState } from 'react';

    export default function Contact() {
      const [submitted, setSubmitted] = useState(false);
      const [form, setForm] = useState({ name: '', email: '', message: '' });

      const handleSubmit = (e) => {
        e.preventDefault();
        if (form.name && form.email && form.message) {
          setSubmitted(true);
        }
      };

      return (
        <section id="contact" className="py-16 md:py-24 px-4 max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-900 mb-6 text-center">Get in Touch</h2>
          {submitted ? (
            <div id="contact-success" className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-emerald-800">
              <p className="font-semibold text-lg">Message sent successfully!</p>
              <p className="text-sm mt-1">Thank you for reaching out. We will respond within 24 hours.</p>
            </div>
          ) : (
            <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                id="contact-submit-btn"
                type="submit"
                className="w-full py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition"
              >
                Send Inquiry
              </button>
            </form>
          )}
        </section>
      );
    }
  `,
};

// ----------------------------------------------------------------------------
// Fixture B: SaaS Product Landing Page
// ----------------------------------------------------------------------------
export const saasFixture = {
  "/styles.css": `
    @import "tailwindcss";
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      overflow-x: hidden;
      background-color: #09090b;
      color: #fafafa;
    }
  `,
  "/App.js": `
    import React from 'react';
    import Header from './components/Header';
    import Hero from './components/Hero';
    import Features from './components/Features';
    import Pricing from './components/Pricing';
    import Footer from './components/Footer';
    import './styles.css';

    export default function App() {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
          <Header />
          <main>
            <Hero />
            <Features />
            <Pricing />
          </main>
          <Footer />
        </div>
      );
    }
  `,
  "/components/Header.js": `
    import React from 'react';

    export default function Header() {
      return (
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-bold text-xl text-white tracking-wider">CLOUDSCALE AI</span>
            <nav className="hidden md:flex space-x-6">
              <a href="#features" className="text-zinc-400 hover:text-white transition">Features</a>
              <a href="#pricing" className="text-zinc-400 hover:text-white transition">Pricing</a>
            </nav>
            <a
              href="#pricing"
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition"
            >
              Get Started
            </a>
          </div>
        </header>
      );
    }
  `,
  "/components/Hero.js": `
    import React, { useState } from 'react';

    export default function Hero() {
      const [email, setEmail] = useState('');
      const [submitted, setSubmitted] = useState(false);
      const [error, setError] = useState('');

      const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!email.includes('@') || !email.includes('.')) {
          setError('Please enter a valid work email');
          return;
        }
        setSubmitted(true);
      };

      return (
        <section id="hero" className="py-24 px-4 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Deploy Autonomous Micro-Agents <br className="hidden sm:inline" />
            <span className="text-indigo-400">at Cloud Scale</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Automate infrastructure, observability, and deployments with collaborative agent pipelines.
          </p>

          {submitted ? (
            <div id="signup-success" className="p-4 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-lg max-w-md mx-auto">
              ✓ Welcome aboard! Check your inbox to activate your cluster.
            </div>
          ) : (
            <form id="hero-signup" noValidate onSubmit={handleSubmit} className="max-w-md mx-auto space-y-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  id="signup-submit-btn"
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition"
                >
                  Start Free
                </button>
              </div>
              {error && <p id="signup-error" className="text-red-400 text-sm mt-1 text-left">{error}</p>}
            </form>
          )}
        </section>
      );
    }
  `,
  "/components/Features.js": `
    import React from 'react';

    const FEATURES = [
      { id: 1, title: 'Multi-Agent Coordination', desc: 'Autonomous consensus across specialized worker instances.' },
      { id: 2, title: 'Zero Cold Start', desc: 'Sub-millisecond worker warm-up via microVM snapshots.' },
      { id: 3, title: 'Deterministic Replay', desc: 'Byte-for-byte execution audit trails for strict compliance.' },
    ];

    export default function Features() {
      return (
        <section id="features" className="py-20 px-4 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Engineered for Reliability</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.id} className="p-8 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }
  `,
  "/components/Pricing.js": `
    import React, { useState } from 'react';

    export default function Pricing() {
      const [isAnnual, setIsAnnual] = useState(false);

      const TIERS = [
        { name: 'Starter', monthly: 29, annual: 24, desc: 'For independent engineers' },
        { name: 'Growth', monthly: 79, annual: 65, popular: true, desc: 'For scaling engineering teams' },
        { name: 'Enterprise', monthly: 199, annual: 165, desc: 'For high-throughput organizations' },
      ];

      return (
        <section id="pricing" className="py-20 px-4 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <div className="flex items-center justify-center gap-3">
              <span className={!isAnnual ? "text-white font-medium text-sm" : "text-zinc-400 text-sm"}>Monthly</span>
              <button
                id="billing-toggle"
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-14 h-8 bg-zinc-800 rounded-full p-1 relative transition"
                aria-label="Toggle Annual Billing"
              >
                <div
                  className={"w-6 h-6 bg-indigo-500 rounded-full transition-transform duration-200 " + (isAnnual ? "translate-x-6" : "translate-x-0")}
                />
              </button>
              <span className={isAnnual ? "text-white font-medium text-sm" : "text-zinc-400 text-sm"}>
                Annual <span id="annual-discount-badge" className="text-xs bg-indigo-900/80 text-indigo-300 px-2 py-0.5 rounded-full ml-1">Save 20%</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={"p-8 rounded-xl border " + (tier.popular ? "bg-zinc-900 border-indigo-500 ring-1 ring-indigo-500" : "bg-zinc-900/50 border-zinc-800")}
              >
                <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-zinc-400 text-sm mb-6">{tier.desc}</p>
                <div className="mb-6">
                  <span className="price-value text-4xl font-extrabold text-white">
                    \${isAnnual ? tier.annual : tier.monthly}
                  </span>
                  <span className="text-zinc-400 text-sm">/mo</span>
                </div>
                <button
                  type="button"
                  className={"w-full py-3 font-medium rounded-lg transition " + (tier.popular ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-zinc-800 text-white hover:bg-zinc-700")}
                >
                  Choose {tier.name}
                </button>
              </div>
            ))}
          </div>
        </section>
      );
    }
  `,
  "/components/Footer.js": `
    import React from 'react';

    export default function Footer() {
      return (
        <footer className="py-12 px-4 border-t border-zinc-900 text-center text-sm text-zinc-500">
          <p>© 2026 CloudScale AI Inc. All rights reserved.</p>
        </footer>
      );
    }
  `,
};

// ----------------------------------------------------------------------------
// Fixture C: Searchable Dataset Directory
// ----------------------------------------------------------------------------
export const directoryFixture = {
  "/styles.css": `
    @import "tailwindcss";
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      overflow-x: hidden;
      background-color: #f8fafc;
      color: #0f172a;
    }
  `,
  "/App.js": `
    import React, { useState } from 'react';
    import SearchBar from './components/SearchBar';
    import FilterTabs from './components/FilterTabs';
    import DirectoryGrid from './components/DirectoryGrid';
    import './styles.css';

    const INITIAL_RESOURCES = [
      { id: 1, title: 'React Architecture Guide', category: 'Engineering', desc: 'Best practices for scalable frontend codebases.' },
      { id: 2, title: 'Design Systems Manual', category: 'Design', desc: 'Figma tokens and accessible component structures.' },
      { id: 3, title: 'Go Microservices Blueprint', category: 'Engineering', desc: 'High-throughput RPC communication patterns.' },
      { id: 4, title: 'Conversion Funnel Strategy', category: 'Marketing', desc: 'Actionable tactics to optimize SaaS trial conversion.' },
      { id: 5, title: 'Motion & Micro-interactions', category: 'Design', desc: 'Creating delight with deliberate animation curves.' },
      { id: 6, title: 'PostgreSQL Query Optimization', category: 'Engineering', desc: 'Index tuning and execution plan analysis.' },
      { id: 7, title: 'Lifecycle Email Automation', category: 'Marketing', desc: 'Automating high-relevance customer onboarding flows.' },
      { id: 8, title: 'Design Token Standardization', category: 'Design', desc: 'Cross-platform design tokens for mobile and web.' },
    ];

    export default function App() {
      const [query, setQuery] = useState('');
      const [category, setCategory] = useState('All');

      const filtered = INITIAL_RESOURCES.filter((item) => {
        const matchesQuery = (item.title + ' ' + item.desc + ' ' + item.category).toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === 'All' || item.category === category;
        return matchesQuery && matchesCategory;
      });

      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
          <header className="py-12 px-4 max-w-5xl mx-auto text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-3">Resource Directory</h1>
            <p className="text-slate-600 max-w-xl mx-auto">Explore curated engineering, design, and growth blueprints.</p>
          </header>
          <main className="max-w-5xl mx-auto px-4 pb-20">
            <div className="space-y-6 mb-10">
              <SearchBar query={query} setQuery={setQuery} />
              <FilterTabs category={category} setCategory={setCategory} />
            </div>
            <DirectoryGrid items={filtered} />
          </main>
        </div>
      );
    }
  `,
  "/components/SearchBar.js": `
    import React from 'react';

    export default function SearchBar({ query, setQuery }) {
      return (
        <div className="relative max-w-xl mx-auto">
          <input
            id="search-input"
            type="search"
            placeholder="Search resources by title or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-4 pr-16 py-3.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {query.length > 0 && (
            <button
              id="clear-search-btn"
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md transition"
            >
              Clear
            </button>
          )}
        </div>
      );
    }
  `,
  "/components/FilterTabs.js": `
    import React from 'react';

    const CATEGORIES = ['All', 'Engineering', 'Design', 'Marketing'];

    export default function FilterTabs({ category, setCategory }) {
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              id={"tab-" + cat.toLowerCase()}
              type="button"
              onClick={() => setCategory(cat)}
              className={"px-4 py-2 rounded-full text-sm font-medium transition " + (category === cat ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100")}
            >
              {cat}
            </button>
          ))}
        </div>
      );
    }
  `,
  "/components/DirectoryGrid.js": `
    import React from 'react';

    export default function DirectoryGrid({ items }) {
      if (items.length === 0) {
        return (
          <div id="empty-state" className="p-12 text-center bg-white border border-slate-200 rounded-2xl max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-2">No results found</h3>
            <p className="text-slate-500 text-sm">We couldn't find any resources matching your search query. Try another keyword or clear filters.</p>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="directory-card p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                {item.category}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-3 mb-2">{item.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      );
    }
  `,
};

// ----------------------------------------------------------------------------
// Fixture D: Interactive E-Commerce Storefront with Cart
// ----------------------------------------------------------------------------
export const ecommerceFixture = {
  "/styles.css": `
    @import "tailwindcss";
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      overflow-x: hidden;
      background-color: #ffffff;
      color: #18181b;
    }
  `,
  "/App.js": `
    import React, { useState } from 'react';
    import Navbar from './components/Navbar';
    import ProductGrid from './components/ProductGrid';
    import CartDrawer from './components/CartDrawer';
    import './styles.css';

    export default function App() {
      const [cart, setCart] = useState([]);
      const [isCartOpen, setIsCartOpen] = useState(false);

      const addToCart = (product) => {
        setCart((prev) => {
          const existing = prev.find((i) => i.id === product.id);
          if (existing) {
            return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
          }
          return [...prev, { ...product, quantity: 1 }];
        });
        setIsCartOpen(true);
      };

      const updateQuantity = (id, delta) => {
        setCart((prev) =>
          prev
            .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
            .filter((i) => i.quantity > 0)
        );
      };

      const removeItem = (id) => {
        setCart((prev) => prev.filter((i) => i.id !== id));
      };

      const totalQuantity = cart.reduce((acc, i) => acc + i.quantity, 0);

      return (
        <div className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">
          <Navbar totalQuantity={totalQuantity} onOpenCart={() => setIsCartOpen(true)} />
          <main className="max-w-6xl mx-auto px-4 py-12">
            <div className="mb-10 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-2">Modern Essentials</h1>
              <p className="text-zinc-600">Thoughtfully designed garments and accessories.</p>
            </div>
            <ProductGrid onAddToCart={addToCart} />
          </main>
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
          />
        </div>
      );
    }
  `,
  "/components/Navbar.js": `
    import React from 'react';

    export default function Navbar({ totalQuantity, onOpenCart }) {
      return (
        <header className="border-b border-zinc-200 sticky top-0 bg-white/95 backdrop-blur z-30">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-extrabold text-xl tracking-wider text-zinc-900">ATELIER</span>
            <button
              id="cart-toggle-btn"
              type="button"
              onClick={onOpenCart}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 transition"
              aria-label="View Cart"
            >
              <span>Bag</span>
              <span id="cart-counter-badge" className="px-2 py-0.5 bg-zinc-900 text-white rounded-full text-xs font-bold">
                {totalQuantity}
              </span>
            </button>
          </div>
        </header>
      );
    }
  `,
  "/components/ProductGrid.js": `
    import React from 'react';

    const PRODUCTS = [
      { id: 'prod_1', title: 'Minimalist Canvas Backpack', price: 120, category: 'Bags' },
      { id: 'prod_2', title: 'Premium Leather Sneakers', price: 180, category: 'Footwear' },
      { id: 'prod_3', title: 'Tailored Wool Overshirt', price: 140, category: 'Apparel' },
    ];

    export default function ProductGrid({ onAddToCart }) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="product-card border border-zinc-200 rounded-2xl p-6 bg-white flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{p.category}</span>
                <h3 className="text-xl font-bold text-zinc-900 mt-2 mb-1">{p.title}</h3>
                <p className="text-lg font-extrabold text-zinc-900 mb-6">\${p.price}</p>
              </div>
              <button
                id={"add-btn-" + p.id}
                type="button"
                onClick={() => onAddToCart(p)}
                className="w-full py-3 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 transition"
              >
                Add to Bag
              </button>
            </div>
          ))}
        </div>
      );
    }
  `,
  "/components/CartDrawer.js": `
    import React from 'react';

    export default function CartDrawer({ isOpen, onClose, cart, onUpdateQuantity, onRemoveItem }) {
      if (!isOpen) return null;

      const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

      return (
        <div id="cart-drawer-backdrop" className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div id="cart-drawer" className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <h2 className="text-xl font-bold text-zinc-900">Your Shopping Bag</h2>
                <button
                  id="close-cart-btn"
                  type="button"
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-zinc-900 text-sm font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              {cart.length === 0 ? (
                <div id="cart-empty-state" className="py-20 text-center text-zinc-500">
                  <p className="font-semibold text-lg text-zinc-700">Your bag is empty</p>
                  <p className="text-sm mt-1">Explore our collection to add items.</p>
                </div>
              ) : (
                <div id="cart-items-list" className="divide-y divide-zinc-200 mt-4 overflow-y-auto max-h-[60vh]">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item py-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-900 text-sm">{item.title}</h4>
                        <p className="text-zinc-500 text-xs">\${item.price} each</p>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="remove-item-btn text-xs text-red-600 hover:underline mt-1"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="qty-dec-btn w-8 h-8 rounded border border-zinc-300 flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100"
                        >
                          -
                        </button>
                        <span className="item-qty-value text-sm font-bold w-6 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="qty-inc-btn w-8 h-8 rounded border border-zinc-300 flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-zinc-200 space-y-4">
                <div className="flex items-center justify-between text-lg font-bold text-zinc-900">
                  <span>Subtotal</span>
                  <span id="cart-subtotal-value">\${subtotal}</span>
                </div>
                <button
                  id="checkout-btn"
                  type="button"
                  className="w-full py-3.5 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 transition"
                >
                  Checkout (\${subtotal})
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
  `,
};
