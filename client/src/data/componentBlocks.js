export const CATEGORIES = [
  'All',
  'Navigation',
  'Hero',
  'Features',
  'Pricing',
  'Social Proof',
  'FAQ',
  'Footer',
];

export const COMPONENT_BLOCKS = [
  {
    id: 'navbar-glass',
    name: 'Glassmorphic Sticky Navbar',
    category: 'Navigation',
    description: 'Sticky header with blurred backdrop, navigation links, mobile menu toggle, and primary CTA.',
    componentName: 'NavbarGlass',
    suggestedPath: '/components/NavbarGlass.jsx',
    reactCode: `import React, { useState } from 'react';
import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';

export default function NavbarGlass() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-zinc-900 border border-white/15 flex items-center justify-center text-zinc-100">
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              PrismUI
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
            <a href="#solutions" className="hover:text-zinc-100 transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-zinc-100 transition-colors">FAQ</a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-zinc-950 px-4 pt-2 pb-4 space-y-2 text-xs">
          <a href="#features" className="block py-2 text-zinc-300 hover:text-white">Features</a>
          <a href="#solutions" className="block py-2 text-zinc-300 hover:text-white">Solutions</a>
          <a href="#pricing" className="block py-2 text-zinc-300 hover:text-white">Pricing</a>
          <a href="#faq" className="block py-2 text-zinc-300 hover:text-white">FAQ</a>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <button
              type="button"
              className="w-full text-center py-2 text-zinc-300 hover:text-white"
            >
              Sign In
            </button>
            <button
              type="button"
              className="w-full py-2 bg-zinc-100 text-zinc-950 font-medium rounded-lg text-center"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}`,
    htmlCode: `<header class="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-white/15 flex items-center justify-center text-zinc-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </div>
        <span class="text-sm font-semibold tracking-tight text-zinc-100">PrismUI</span>
      </div>
      <nav class="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
        <a href="#features" class="hover:text-zinc-100 transition-colors">Features</a>
        <a href="#solutions" class="hover:text-zinc-100 transition-colors">Solutions</a>
        <a href="#pricing" class="hover:text-zinc-100 transition-colors">Pricing</a>
        <a href="#faq" class="hover:text-zinc-100 transition-colors">FAQ</a>
      </nav>
      <div class="hidden md:flex items-center gap-3">
        <a href="#login" class="text-xs font-medium text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg transition-colors">Sign In</a>
        <a href="#signup" class="inline-flex items-center gap-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm">Get Started</a>
      </div>
    </div>
  </div>
</header>`,
  },
  {
    id: 'hero-split',
    name: 'Split Hero with Terminal Preview',
    category: 'Hero',
    description: 'High-impact two-column hero with launch badge, dual CTAs, and interactive terminal dashboard.',
    componentName: 'HeroSplit',
    suggestedPath: '/components/HeroSplit.jsx',
    reactCode: `import React from 'react';
import { ArrowRight, Terminal, Check, Sparkles } from 'lucide-react';

export default function HeroSplit() {
  return (
    <section className="relative overflow-hidden bg-zinc-950 py-20 lg:py-28 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-zinc-900/60 text-[11px] font-mono text-zinc-300">
              <Sparkles size={12} className="text-zinc-400" />
              <span>Next-Gen Fullstack Infrastructure</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">v2.0 Launched</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-tight">
              Build resilient apps at the speed of thought.
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 max-w-xl font-normal leading-relaxed">
              Automate code generation, visual regression tests, and zero-downtime rollouts with an autonomous multi-agent developer system.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 text-xs sm:text-sm font-medium hover:bg-white transition-all shadow-lg active:scale-95"
              >
                <span>Deploy Free Project</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-zinc-900/80 text-zinc-300 text-xs sm:text-sm font-medium hover:text-white hover:bg-zinc-800 transition-all active:scale-95"
              >
                <span>Documentation</span>
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-zinc-300" />
                <span>Zero configuration</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-zinc-300" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-zinc-300" />
                <span>One-click deploy</span>
              </div>
            </div>
          </div>

          {/* Right Column: Code / Terminal Mockup */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl shadow-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-zinc-700" />
                  <div className="size-2.5 rounded-full bg-zinc-700" />
                  <div className="size-2.5 rounded-full bg-zinc-700" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                  <Terminal size={11} />
                  <span>terminal ~ bash</span>
                </div>
              </div>

              <div className="mt-4 space-y-2.5 font-mono text-xs">
                <div className="text-zinc-400 flex items-center gap-2">
                  <span className="text-zinc-600">$</span>
                  <span>npx create-autonomous-app@latest</span>
                </div>
                <div className="text-emerald-400/90 pl-3 text-[11px]">
                  ✔ Analyzing stack specifications...
                </div>
                <div className="text-emerald-400/90 pl-3 text-[11px]">
                  ✔ Synthesizing Tailwind & React modules...
                </div>
                <div className="text-emerald-400/90 pl-3 text-[11px]">
                  ✔ Visual QA passed (1440px & 375px verified)
                </div>
                <div className="text-zinc-300 pt-2 flex items-center justify-between border-t border-white/5 text-[11px]">
                  <span>Local Preview:</span>
                  <span className="text-zinc-400 underline">http://localhost:3000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="relative overflow-hidden bg-zinc-950 py-20 lg:py-28 text-zinc-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
      <div class="lg:col-span-7 space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-zinc-900/60 text-[11px] font-mono text-zinc-300">
          <span>Autonomous Fullstack Agent</span>
          <span class="text-zinc-500">•</span>
          <span class="text-zinc-400">v2.0 Ready</span>
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-tight">
          Build resilient apps at the speed of thought.
        </h1>
        <p class="text-base sm:text-lg text-zinc-400 max-w-xl font-normal leading-relaxed">
          Automate code generation, visual regression tests, and zero-downtime rollouts with an autonomous multi-agent developer system.
        </p>
        <div class="flex flex-wrap items-center gap-3 pt-2">
          <a href="#get-started" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 text-xs sm:text-sm font-medium hover:bg-white transition-all shadow-lg">
            Deploy Free Project
          </a>
          <a href="#docs" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-zinc-900/80 text-zinc-300 text-xs sm:text-sm font-medium hover:text-white transition-all">
            Documentation
          </a>
        </div>
      </div>
      <div class="lg:col-span-5">
        <div class="rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl shadow-2xl p-5 overflow-hidden">
          <div class="flex items-center justify-between pb-3 border-b border-white/5 font-mono text-xs text-zinc-500">
            <span>app-deploy.log</span>
          </div>
          <div class="mt-4 space-y-2 font-mono text-xs text-zinc-400">
            <p><span class="text-zinc-600">$</span> npx deploy-project</p>
            <p class="text-emerald-400">✔ Build passed in 480ms</p>
            <p class="text-emerald-400">✔ Live URL generated</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'feature-bento',
    name: 'Asymmetric Bento Grid Features',
    category: 'Features',
    description: '3-column responsive bento layout highlighting core system capabilities with clean borders and hover states.',
    componentName: 'FeatureBento',
    suggestedPath: '/components/FeatureBento.jsx',
    reactCode: `import React from 'react';
import { Zap, ShieldCheck, Cpu, Layers, ArrowUpRight } from 'lucide-react';

export default function FeatureBento() {
  const cards = [
    {
      title: 'Autonomous Code Synthesis',
      description: 'Generates end-to-end component trees, reactive state stores, and layout primitives from natural language.',
      icon: Cpu,
      span: 'lg:col-span-8',
      tag: 'Core Engine',
    },
    {
      title: 'Zero Latency Live Preview',
      description: 'In-browser compilation via isolated web sandboxes with instant hot reloading.',
      icon: Zap,
      span: 'lg:col-span-4',
      tag: 'Performance',
    },
    {
      title: 'Dual-Viewport Visual QA',
      description: 'Headless Chrome verification at 1440px and 375px detecting horizontal overflow and layout defects.',
      icon: ShieldCheck,
      span: 'lg:col-span-4',
      tag: 'Reliability',
    },
    {
      title: 'Architectural Design Intelligence',
      description: 'Selects typography pairings, palette contracts, and spatial grids tuned to your product archetype.',
      icon: Layers,
      span: 'lg:col-span-8',
      tag: 'Design System',
    },
  ];

  return (
    <section className="py-20 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Platform Architecture</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Engineered for craft and velocity.
          </h2>
          <p className="text-sm text-zinc-400">
            A cohesive suite of autonomous tools designed to streamline your entire frontend development lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={i}
                className={\`\${c.span} rounded-2xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/70 p-6 sm:p-8 transition-all flex flex-col justify-between group\`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="size-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-100 group-hover:scale-105 transition-transform">
                      <Icon size={18} />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 border border-white/10 text-zinc-400">
                      {c.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-medium text-white mb-2 group-hover:text-zinc-100">
                    {c.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                    {c.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/5 flex items-center gap-1 text-xs text-zinc-400 group-hover:text-white transition-colors">
                  <span>Explore capability</span>
                  <ArrowUpRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="py-20 bg-zinc-950 text-zinc-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-14 space-y-3">
      <p class="text-xs font-mono uppercase tracking-widest text-zinc-400">Platform Architecture</p>
      <h2 class="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Engineered for craft and velocity.</h2>
      <p class="text-sm text-zinc-400">A cohesive suite of autonomous tools designed to streamline your entire frontend development lifecycle.</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div class="lg:col-span-8 rounded-2xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8">
        <h3 class="text-lg font-medium text-white mb-2">Autonomous Code Synthesis</h3>
        <p class="text-xs sm:text-sm text-zinc-400">Generates end-to-end component trees, reactive state stores, and layout primitives from natural language.</p>
      </div>
      <div class="lg:col-span-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8">
        <h3 class="text-lg font-medium text-white mb-2">Zero Latency Live Preview</h3>
        <p class="text-xs sm:text-sm text-zinc-400">In-browser compilation via isolated web sandboxes with instant hot reloading.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'pricing-tiers',
    name: 'Interactive Tiered Pricing',
    category: 'Pricing',
    description: 'Clean monochrome pricing cards with monthly / annual toggle, popular plan highlight, and feature lists.',
    componentName: 'PricingTiers',
    suggestedPath: '/components/PricingTiers.jsx',
    reactCode: `import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

export default function PricingTiers() {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      name: 'Hobby',
      description: 'Ideal for independent creators building personal experiments.',
      monthlyPrice: 0,
      annualPrice: 0,
      features: ['Up to 3 active projects', 'Standard code export', 'Community support', 'Sandpack live preview'],
      cta: 'Start Free',
      popular: false,
    },
    {
      name: 'Professional',
      description: 'For engineers and designers shipping production applications.',
      monthlyPrice: 29,
      annualPrice: 24,
      features: [
        'Unlimited cloud projects',
        'Headless Visual QA engine',
        'Autonomous multi-file refactoring',
        'Custom domain publishing',
        'Priority model inference',
      ],
      cta: 'Start 14-Day Trial',
      popular: true,
    },
    {
      name: 'Organization',
      description: 'Dedicated resources and enterprise governance for teams.',
      monthlyPrice: 99,
      annualPrice: 89,
      features: [
        'Everything in Professional',
        'Custom design archetypes',
        'Single Sign-On (SSO / SAML)',
        'Audit logs & SLA guarantees',
        'Dedicated engineering support',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section className="py-20 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Transparent Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Predictable plans for every stage.
          </h2>
          <p className="text-sm text-zinc-400">
            Scale seamlessly from weekend prototypes to mission-critical infrastructure.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={\`text-xs font-medium \${!annual ? 'text-white' : 'text-zinc-500'}\`}>Monthly</span>
            <button
              type="button"
              onClick={() => setAnnual(!annual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-800 border border-white/10 transition-colors focus:outline-none"
            >
              <span
                className={\`inline-block size-4 transform rounded-full bg-white transition-transform \${annual ? 'translate-x-6' : 'translate-x-1'}\`}
              />
            </button>
            <span className={\`text-xs font-medium flex items-center gap-1.5 \${annual ? 'text-white' : 'text-zinc-500'}\`}>
              <span>Annual</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, index) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice;
            return (
              <div
                key={index}
                className={\`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between relative transition-all \${
                  tier.popular
                    ? 'bg-zinc-900/90 border-white/25 shadow-2xl scale-[1.02]'
                    : 'bg-zinc-900/30 border-white/10 hover:border-white/20'
                }\`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white text-zinc-950 text-[10px] font-semibold tracking-wide uppercase flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 min-h-[32px]">{tier.description}</p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold text-white font-mono">\${price}</span>
                    <span className="text-xs text-zinc-500 font-mono">/ month</span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-white/5 pt-6 text-xs text-zinc-300">
                    {tier.features.map((feat, fi) => (
                      <li key={fi} className="flex items-center gap-2">
                        <Check size={14} className="text-zinc-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    className={\`w-full py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 \${
                      tier.popular
                        ? 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-md font-semibold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10'
                    }\`}
                  >
                    {tier.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="py-20 bg-zinc-950 text-zinc-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
      <h2 class="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Transparent, predictable pricing.</h2>
      <p class="text-sm text-zinc-400">Scale seamlessly from weekend prototypes to mission-critical infrastructure.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 flex flex-col justify-between">
        <div>
          <h3 class="text-base font-semibold text-white">Hobby</h3>
          <p class="text-3xl font-mono font-semibold text-white mt-4">$0 <span class="text-xs text-zinc-500">/mo</span></p>
          <ul class="mt-6 space-y-2 text-xs text-zinc-300">
            <li>✔ 3 active projects</li>
            <li>✔ Standard export</li>
          </ul>
        </div>
        <button class="mt-6 w-full py-2 bg-zinc-800 text-xs rounded-xl font-medium text-white">Start Free</button>
      </div>
      <div class="rounded-2xl border border-white/25 bg-zinc-900 p-6 flex flex-col justify-between shadow-xl">
        <div>
          <h3 class="text-base font-semibold text-white">Pro</h3>
          <p class="text-3xl font-mono font-semibold text-white mt-4">$29 <span class="text-xs text-zinc-500">/mo</span></p>
          <ul class="mt-6 space-y-2 text-xs text-zinc-300">
            <li>✔ Unlimited projects</li>
            <li>✔ Visual QA engine</li>
          </ul>
        </div>
        <button class="mt-6 w-full py-2 bg-white text-zinc-950 text-xs rounded-xl font-medium">Upgrade to Pro</button>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'testimonials-grid',
    name: 'Wall of Social Proof',
    category: 'Social Proof',
    description: '3-column customer quote grid with star ratings, verified company roles, and key metrics.',
    componentName: 'TestimonialsGrid',
    suggestedPath: '/components/TestimonialsGrid.jsx',
    reactCode: `import React from 'react';
import { Star } from 'lucide-react';

export default function TestimonialsGrid() {
  const reviews = [
    {
      quote: 'We cut our design-to-production turnaround from two weeks to under four hours using autonomous block synthesis.',
      author: 'Elena Rostova',
      role: 'Staff Frontend Architect',
      company: 'Synthetix Cloud',
      rating: 5,
    },
    {
      quote: 'The dual-viewport visual QA engine caught 12 responsive layout regressions before our PR even hit staging.',
      author: 'Marcus Vance',
      role: 'VP of Engineering',
      company: 'HyperScale Labs',
      rating: 5,
    },
    {
      quote: 'Clean React code generation with zero extraneous dependencies. It actually writes code the way our team writes code.',
      author: 'Aria Takahashi',
      role: 'Founding Engineer',
      company: 'NextLayer',
      rating: 5,
    },
  ];

  return (
    <section className="py-20 bg-zinc-950 text-zinc-100 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Developer Endorsements</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Trusted by engineers shipping at scale.
          </h2>
          <p className="text-sm text-zinc-400">
            See how top software engineering teams accelerate their product delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 flex flex-col justify-between hover:border-white/20 transition-colors"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(r.rating)].map((_, s) => (
                    <Star key={s} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed font-normal">
                  "{r.quote}"
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-white/5 flex items-center gap-3">
                <div className="size-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-medium text-zinc-200">
                  {r.author.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-medium text-white">{r.author}</div>
                  <div className="text-[11px] text-zinc-400">
                    {r.role} · <span className="text-zinc-500">{r.company}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="py-20 bg-zinc-950 text-zinc-100 border-t border-white/5">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
      <h2 class="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Trusted by engineers shipping at scale.</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <p class="text-sm text-zinc-300">"We cut our turnaround from two weeks to under four hours using autonomous block synthesis."</p>
        <div class="mt-4 text-xs font-medium text-white">Elena Rostova <span class="text-zinc-500">· Synthetix</span></div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <p class="text-sm text-zinc-300">"The dual-viewport visual QA engine caught 12 responsive layout regressions before staging."</p>
        <div class="mt-4 text-xs font-medium text-white">Marcus Vance <span class="text-zinc-500">· HyperScale Labs</span></div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'faq-accordion',
    name: 'Collapsible FAQ Accordion',
    category: 'FAQ',
    description: 'Accessible interactive accordion with animated chevron expand/collapse for frequently asked questions.',
    componentName: 'FaqAccordion',
    suggestedPath: '/components/FaqAccordion.jsx',
    reactCode: `import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Mail } from 'lucide-react';

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  const items = [
    {
      q: 'How does code generation compile inside Sandpack without backend servers?',
      a: 'We leverage in-browser client bundling via CodeSandbox Sandpack. React 18 and Lucide icons are pre-cached on edge CDNs, allowing zero-latency builds directly on the user device.',
    },
    {
      q: 'Can I export the generated files to an external repository or local machine?',
      a: 'Yes. Every project supports instant 1-click ZIP export containing standard package.json configs, Tailwind setup, and pure modular component files ready for Next.js or Vite.',
    },
    {
      q: 'How does the visual verification engine detect mobile layout overflow?',
      a: 'Our background worker renders the preview canvas in both 1440x900 desktop and 375x812 mobile viewports, querying scrollWidth against clientWidth to pinpoint layout breakages.',
    },
    {
      q: 'Can I insert component blocks into existing projects without overwriting work?',
      a: 'Absolutely. The component catalog automatically checks your file tree for naming collisions (e.g., generating HeroSection2.jsx if HeroSection.jsx already exists) and copies clean import snippets to your clipboard.',
    },
  ];

  return (
    <section className="py-20 bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-zinc-900 text-xs font-mono text-zinc-400">
            <HelpCircle size={13} />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-zinc-400">
            Everything you need to know about the architecture, security, and export workflows.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-zinc-900/40 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/60 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={\`text-zinc-400 transition-transform duration-200 shrink-0 \${isOpen ? 'rotate-180 text-white' : ''}\`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center p-6 rounded-2xl border border-white/10 bg-zinc-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="text-sm font-medium text-white">Still have questions?</h4>
            <p className="text-xs text-zinc-400 mt-0.5">Reach out to our engineering support team anytime.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
          >
            <Mail size={13} />
            <span>Contact Support</span>
          </button>
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="py-20 bg-zinc-950 text-zinc-100">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12 space-y-3">
      <h2 class="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Frequently Asked Questions</h2>
    </div>
    <div class="space-y-3">
      <details class="group rounded-xl border border-white/10 bg-zinc-900/40 p-5" open>
        <summary class="text-sm font-medium text-white cursor-pointer list-none flex items-center justify-between">
          <span>How does code compilation work?</span>
          <span class="text-xs text-zinc-500 group-open:rotate-180">▼</span>
        </summary>
        <p class="mt-3 text-xs text-zinc-400 leading-relaxed">We leverage in-browser client bundling via CodeSandbox Sandpack for zero-latency execution.</p>
      </details>
      <details class="group rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <summary class="text-sm font-medium text-white cursor-pointer list-none flex items-center justify-between">
          <span>Can I export project files?</span>
          <span class="text-xs text-zinc-500 group-open:rotate-180">▼</span>
        </summary>
        <p class="mt-3 text-xs text-zinc-400 leading-relaxed">Yes, every project supports 1-click ZIP export ready for local development or Vercel deploy.</p>
      </details>
    </div>
  </div>
</section>`,
  },
  {
    id: 'footer-minimal',
    name: 'Minimalist Multi-Column Footer',
    category: 'Footer',
    description: 'Clean monochrome footer with newsletter signup, structured navigation columns, system status, and copyright.',
    componentName: 'FooterMinimal',
    suggestedPath: '/components/FooterMinimal.jsx',
    reactCode: `import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

export default function FooterMinimal() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="border-t border-white/10 bg-zinc-950 text-zinc-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand & Newsletter Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-zinc-900 border border-white/15 flex items-center justify-center text-zinc-100">
                <Sparkles size={14} />
              </div>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                PrismUI Platform
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              Curated, high-craft UI component primitives designed for high-velocity software engineering teams.
            </p>

            <form onSubmit={handleSubmit} className="pt-2 flex items-center gap-2 max-w-sm">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Subscribe to changelog..."
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 flex-1 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-white text-zinc-950 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors shrink-0 flex items-center gap-1"
              >
                {subscribed ? <Check size={14} /> : <ArrowRight size={14} />}
              </button>
            </form>
            {subscribed && (
              <p className="text-[11px] text-emerald-400 font-mono">✔ Subscribed to release alerts.</p>
            )}
          </div>

          {/* Links Columns */}
          <div className="md:col-span-7 grid grid-cols-3 gap-6 text-xs">
            <div>
              <h4 className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px] font-mono mb-3">
                Product
              </h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Component Blocks</a></li>
                <li><a href="#visual-qa" className="hover:text-white transition-colors">Visual QA Engine</a></li>
                <li><a href="#sandpack" className="hover:text-white transition-colors">Sandpack Sandbox</a></li>
                <li><a href="#changelog" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px] font-mono mb-3">
                Resources
              </h4>
              <ul className="space-y-2">
                <li><a href="#docs" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#api" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#guides" className="hover:text-white transition-colors">Guides</a></li>
                <li><a href="#templates" className="hover:text-white transition-colors">Templates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px] font-mono mb-3">
                Company
              </h4>
              <ul className="space-y-2">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#careers" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500 font-mono">
          <p>© {new Date().getFullYear()} PrismUI. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}`,
    htmlCode: `<footer class="border-t border-white/10 bg-zinc-950 text-zinc-400 py-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-10">
      <div class="md:col-span-6 space-y-3">
        <span class="text-sm font-semibold tracking-tight text-zinc-100">PrismUI Platform</span>
        <p class="text-xs text-zinc-400 max-w-sm">Curated, high-craft UI component primitives designed for high-velocity software engineering teams.</p>
      </div>
      <div class="md:col-span-6 grid grid-cols-2 gap-6 text-xs">
        <div>
          <h4 class="font-mono text-zinc-200 mb-2">Navigation</h4>
          <ul class="space-y-1.5">
            <li><a href="#features" class="hover:text-white">Features</a></li>
            <li><a href="#pricing" class="hover:text-white">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-mono text-zinc-200 mb-2">Legal</h4>
          <ul class="space-y-1.5">
            <li><a href="#privacy" class="hover:text-white">Privacy</a></li>
            <li><a href="#terms" class="hover:text-white">Terms</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="mt-10 pt-6 border-t border-white/5 text-[11px] text-zinc-500 font-mono">
      <p>© 2026 PrismUI. All rights reserved.</p>
    </div>
  </div>
</footer>`,
  },
  {
    id: 'cta-banner',
    name: 'Radial Glow Call to Action',
    category: 'Hero',
    description: 'High-conversion banner with subtle radial backdrop glow, action buttons, and trust metrics.',
    componentName: 'CtaBanner',
    suggestedPath: '/components/CtaBanner.jsx',
    reactCode: `import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CtaBanner() {
  return (
    <section className="relative overflow-hidden py-20 bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-zinc-800/60 text-xs font-mono text-zinc-300 mb-6">
            <Sparkles size={12} className="text-zinc-400" />
            <span>Ready for Immediate Deployment</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Start synthesizing production web apps today.
          </h2>

          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto mt-4 font-normal leading-relaxed">
            Join thousands of developers turning ideas into verified, responsive applications with zero setup friction.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-zinc-950 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
            >
              <span>Get Started Now</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium transition-all active:scale-95"
            >
              <span>Schedule Live Demo</span>
            </button>
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-zinc-300" />
              <span>Full source-code ownership</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-zinc-300" />
              <span>Zero vendor lock-in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-zinc-300" />
              <span>100% Tailwind CSS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}`,
    htmlCode: `<section class="relative overflow-hidden py-20 bg-zinc-950 text-zinc-100">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-3xl border border-white/15 bg-zinc-900/80 p-8 sm:p-14 text-center">
      <h2 class="text-3xl sm:text-5xl font-semibold tracking-tight text-white max-w-2xl mx-auto">Start synthesizing production web apps today.</h2>
      <p class="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto mt-4">Join thousands of developers turning ideas into verified, responsive applications with zero friction.</p>
      <div class="mt-8 flex justify-center gap-3">
        <a href="#get-started" class="px-6 py-3 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200">Get Started Now</a>
      </div>
    </div>
  </div>
</section>`,
  },
];
