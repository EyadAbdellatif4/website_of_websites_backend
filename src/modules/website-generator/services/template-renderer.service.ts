import { Injectable } from '@nestjs/common';
import {
  GenerationContext,
  RenderedFile,
} from '../interfaces/generator.interface';

@Injectable()
export class TemplateRendererService {
  /**
   * Render all source, configuration, and component files for the Next.js project
   */
  renderProjectFiles(ctx: GenerationContext): RenderedFile[] {
    const files: RenderedFile[] = [];

    // 1. Root Configuration Files
    files.push({
      relativePath: 'package.json',
      content: this.renderPackageJson(ctx),
    });

    files.push({
      relativePath: 'tsconfig.json',
      content: this.renderTsConfig(),
    });

    files.push({
      relativePath: 'next.config.ts',
      content: this.renderNextConfig(),
    });

    files.push({
      relativePath: 'postcss.config.mjs',
      content: this.renderPostcssConfig(),
    });

    files.push({
      relativePath: 'tailwind.config.ts',
      content: this.renderTailwindConfig(),
    });

    files.push({
      relativePath: '.env.example',
      content: this.renderEnvExample(),
    });

    files.push({
      relativePath: 'README.md',
      content: this.renderReadme(ctx),
    });

    // 2. Next.js App Router Files
    files.push({
      relativePath: 'app/globals.css',
      content: this.renderGlobalsCss(),
    });

    files.push({
      relativePath: 'app/layout.tsx',
      content: this.renderRootLayout(ctx),
    });

    files.push({
      relativePath: 'app/page.tsx',
      content: this.renderMainPage(ctx),
    });

    // 3. Section Component Files
    const renderedSectionNames = new Set<string>();

    for (const section of ctx.layout.sections) {
      const sectionType = (section.type || 'generic').toLowerCase();
      const componentName = this.getSectionComponentName(sectionType);

      if (!renderedSectionNames.has(componentName)) {
        renderedSectionNames.add(componentName);
        files.push({
          relativePath: `components/sections/${componentName}.tsx`,
          content: this.renderSectionComponent(componentName, sectionType),
        });
      }
    }

    // Always ensure GenericSection is available as fallback
    if (!renderedSectionNames.has('GenericSection')) {
      files.push({
        relativePath: 'components/sections/GenericSection.tsx',
        content: this.renderSectionComponent('GenericSection', 'generic'),
      });
    }

    return files;
  }

  public getSectionComponentName(type: string): string {
    const map: Record<string, string> = {
      header: 'HeaderSection',
      navbar: 'HeaderSection',
      nav: 'HeaderSection',
      hero: 'HeroSection',
      features: 'FeaturesSection',
      feature: 'FeaturesSection',
      services: 'ServicesSection',
      service: 'ServicesSection',
      about: 'AboutSection',
      testimonials: 'TestimonialsSection',
      testimonial: 'TestimonialsSection',
      reviews: 'TestimonialsSection',
      pricing: 'PricingSection',
      gallery: 'GallerySection',
      portfolio: 'GallerySection',
      contact: 'ContactSection',
      footer: 'FooterSection',
    };

    return map[type.toLowerCase()] || 'GenericSection';
  }

  private renderPackageJson(ctx: GenerationContext): string {
    const sanitizedName =
      ctx.designName
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'generated-website';

    const pkg = {
      name: sanitizedName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        next: '^15.1.0',
        'lucide-react': '^0.468.0',
        clsx: '^2.1.1',
        'tailwind-merge': '^2.5.5',
      },
      devDependencies: {
        typescript: '^5.7.0',
        '@types/node': '^20.0.0',
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        postcss: '^8.4.49',
        tailwindcss: '^3.4.16',
        autoprefixer: '^10.4.20',
      },
    };

    return JSON.stringify(pkg, null, 2);
  }

  private renderTsConfig(): string {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: {
          '@/*': ['./*'],
        },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    };

    return JSON.stringify(tsconfig, null, 2);
  }

  private renderNextConfig(): string {
    return `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
`;
  }

  private renderPostcssConfig(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  private renderTailwindConfig(): string {
    return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
`;
  }

  private renderGlobalsCss(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090b;
  --foreground: #fafafa;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #09090b;
}
::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
`;
  }

  private renderRootLayout(ctx: GenerationContext): string {
    const title = ctx.designName || 'Generated Website';
    return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${this.escapeJsString(title)}',
  description: 'Generated with Next.js and Tailwind CSS from structured visual design analysis.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
`;
  }

  private renderMainPage(ctx: GenerationContext): string {
    // Generate imports for unique section components
    const uniqueComponentTypes = new Set<string>();
    for (const sec of ctx.layout.sections) {
      uniqueComponentTypes.add(
        this.getSectionComponentName(sec.type || 'generic'),
      );
    }

    const importStatements = Array.from(uniqueComponentTypes)
      .map(
        (compName) =>
          `import { ${compName} } from '@/components/sections/${compName}';`,
      )
      .join('\n');

    // Group placeholders by section_id
    const placeholdersBySection: Record<string, unknown[]> = {};
    for (const ph of ctx.placeholders) {
      const secId = ph.section_id || 'default';
      if (!placeholdersBySection[secId]) {
        placeholdersBySection[secId] = [];
      }

      // Map image values to publicUrlPath if copied asset exists
      let finalValue = ph.value;
      if (
        ph.type === 'image' &&
        ph.value &&
        typeof ph.value === 'object' &&
        'storage_key' in (ph.value as Record<string, unknown>)
      ) {
        const imgObj = ph.value as Record<string, unknown>;
        const matchedAsset = ctx.assets.find(
          (a) => a.originalStorageKey === imgObj.storage_key,
        );
        if (matchedAsset) {
          finalValue = {
            ...imgObj,
            src: matchedAsset.publicUrlPath,
          };
        }
      }

      placeholdersBySection[secId].push({
        id: ph.id,
        type: ph.type,
        role: ph.role,
        bounds: ph.bounds,
        content_hint: ph.content_hint,
        value: finalValue,
      });
    }

    // Build JSX for each section in exact order
    const sectionRenders = ctx.layout.sections
      .map((sec, idx) => {
        const compName = this.getSectionComponentName(sec.type || 'generic');
        const secPlaceholders = placeholdersBySection[sec.id] || [];
        const encodedData = JSON.stringify(secPlaceholders, null, 2);

        return `      {/* Section: ${sec.type} (#${idx + 1}) */}
      <${compName}
        sectionId="${this.escapeJsString(sec.id)}"
        bounds={${JSON.stringify(sec.bounds)}}
        styles={${JSON.stringify(sec.styles || {})}}
        placeholders={${encodedData}}
      />`;
      })
      .join('\n\n');

    return `import React from 'react';
${importStatements}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
${sectionRenders}
    </main>
  );
}
`;
  }

  private renderSectionComponent(
    componentName: string,
    sectionType: string,
  ): string {
    switch (componentName) {
      case 'HeaderSection':
        return this.renderHeaderComponentTemplate();
      case 'HeroSection':
        return this.renderHeroComponentTemplate();
      case 'FeaturesSection':
        return this.renderFeaturesComponentTemplate();
      case 'ServicesSection':
        return this.renderServicesComponentTemplate();
      case 'AboutSection':
        return this.renderAboutComponentTemplate();
      case 'TestimonialsSection':
        return this.renderTestimonialsComponentTemplate();
      case 'PricingSection':
        return this.renderPricingComponentTemplate();
      case 'GallerySection':
        return this.renderGalleryComponentTemplate();
      case 'ContactSection':
        return this.renderContactComponentTemplate();
      case 'FooterSection':
        return this.renderFooterComponentTemplate();
      case 'GenericSection':
      default:
        return this.renderGenericComponentTemplate(sectionType);
    }
  }

  private renderHeaderComponentTemplate(): string {
    return `import React from 'react';
import Link from 'next/link';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  styles?: {
    background_color?: string;
    text_color?: string;
    primary_color?: string;
    secondary_color?: string;
  };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function HeaderSection({ sectionId, styles, placeholders }: SectionProps) {
  const brandTitle =
    placeholders.find(p => p.role.includes('logo') || p.role.includes('brand') || p.type === 'logo')?.value ||
    'Serendale';
  const logoImg = placeholders.find(p => (p.type === 'image' || p.type === 'logo') && p.value?.src);
  const links = placeholders.filter(p => p.type === 'link' || p.role.includes('nav') || p.role.includes('link'));
  const ctaBtn = placeholders.find(p => p.type === 'button');

  const bgStyle = styles?.background_color || '#000000';
  const textStyle = styles?.text_color || '#ffffff';
  const primaryColor = styles?.primary_color || '#3b82f6';

  return (
    <header
      id={sectionId}
      className="sticky top-0 z-50 w-full border-b border-zinc-800/80 backdrop-blur-md transition-colors"
      style={{ backgroundColor: \`\${bgStyle}cc\`, color: textStyle }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 font-bold text-xl text-white hover:opacity-90 transition">
          {logoImg?.value?.src ? (
            <img
              src={logoImg.value.src}
              alt={typeof brandTitle === 'string' ? brandTitle : 'Logo'}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span className="font-extrabold tracking-tight text-white">
              {typeof brandTitle === 'string' ? brandTitle : 'Serendale'}
            </span>
          )}
        </Link>

        {/* Navigation Links - Centered */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
          {links.length > 0 ? (
            links.map(link => {
              const text =
                typeof link.value === 'object' && link.value?.text
                  ? link.value.text
                  : typeof link.value === 'string'
                  ? link.value
                  : link.content_hint || 'Navigation';
              const href =
                typeof link.value === 'object' && link.value?.url ? link.value.url : '#';
              return (
                <Link
                  key={link.id}
                  href={href}
                  className="transition hover:text-white text-zinc-300"
                >
                  {text}
                </Link>
              );
            })
          ) : (
            <>
              <Link href="#contracts" className="hover:text-white text-zinc-300 transition">Smart Contracts</Link>
              <Link href="#services" className="hover:text-white text-zinc-300 transition">Services</Link>
              <Link href="#solutions" className="hover:text-white text-zinc-300 transition">Solutions</Link>
              <Link href="#roadmap" className="hover:text-white text-zinc-300 transition">Roadmap</Link>
              <Link href="#whitepaper" className="hover:text-white text-zinc-300 transition">Whitepaper</Link>
            </>
          )}
        </nav>

        {/* CTA Button / Actions */}
        <div className="flex items-center gap-4">
          {ctaBtn ? (
            <Link
              href={typeof ctaBtn.value === 'object' && ctaBtn.value?.url ? ctaBtn.value.url : '#'}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {typeof ctaBtn.value === 'object' && ctaBtn.value?.text
                ? ctaBtn.value.text
                : typeof ctaBtn.value === 'string'
                ? ctaBtn.value
                : ctaBtn.content_hint || 'Get Started'}
            </Link>
          ) : (
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="text-xs hover:text-white cursor-pointer transition">★</span>
              <span className="text-xs hover:text-white cursor-pointer transition">✦</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
`;
  }

  private renderHeroComponentTemplate(): string {
    return `import React from 'react';
import Link from 'next/link';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  styles?: {
    background_color?: string;
    text_color?: string;
    primary_color?: string;
    secondary_color?: string;
  };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function HeroSection({ sectionId, styles, placeholders }: SectionProps) {
  // Collect all text headings & description
  const headingItems = placeholders.filter(p => p.role.includes('heading') || p.role.includes('title') || (p.type === 'text' && !p.role.includes('desc')));
  const descItem = placeholders.find(p => p.role.includes('desc') || p.role.includes('body') || p.role.includes('sub'));
  const heroImage = placeholders.find(p => p.type === 'image' && p.value?.src);
  const buttons = placeholders.filter(p => p.type === 'button');

  const bgStyle = styles?.background_color || '#000000';
  const textStyle = styles?.text_color || '#ffffff';
  const primaryColor = styles?.primary_color || '#3b82f6';
  const secondaryColor = styles?.secondary_color || '#a855f7';

  // Format heading texts
  const headings = headingItems.length > 0
    ? headingItems.map(h => typeof h.value === 'string' ? h.value : (h.content_hint || 'Next-Gen Blockchain.'))
    : ['A Fast Blockchain.', 'Scalable AI.'];

  const description = descItem
    ? (typeof descItem.value === 'string' ? descItem.value : descItem.content_hint)
    : 'Our technology performing fast blockchain (120K TPS) and it has guaranteed AI-based data security. Proof of Stake, its consensus algorithm enables unlimited speeds.';

  return (
    <section
      id={sectionId}
      className="relative overflow-hidden py-24 sm:py-32 flex flex-col items-center justify-center min-h-[680px]"
      style={{ backgroundColor: bgStyle, color: textStyle }}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-fuchsia-600/20 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-cyan-500/20 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center space-y-8 z-10">
        {/* Main Multi-Line Headings */}
        <div className="space-y-3">
          {headings.map((head, idx) => (
            <h1
              key={idx}
              className={\`text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight \${
                idx === 0
                  ? 'bg-gradient-to-r from-fuchsia-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent'
                  : 'text-white'
              }\`}
            >
              {head}
            </h1>
          ))}
        </div>

        {/* Subtitle / Description */}
        <p className="mx-auto max-w-2xl text-base sm:text-lg text-zinc-300/90 leading-relaxed">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {buttons.length > 0 ? (
            buttons.map((btn, idx) => {
              const text =
                typeof btn.value === 'object' && btn.value?.text
                  ? btn.value.text
                  : typeof btn.value === 'string'
                  ? btn.value
                  : btn.content_hint || (idx === 0 ? 'Get started' : 'Ecosystems');
              const href =
                typeof btn.value === 'object' && btn.value?.url ? btn.value.url : '#';
              const isPrimary = idx === 0;

              return (
                <Link
                  key={btn.id}
                  href={href}
                  className={\`rounded-xl px-7 py-3.5 text-sm font-semibold transition shadow-xl \${
                    isPrimary
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                      : 'bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 backdrop-blur'
                  }\`}
                  style={isPrimary && primaryColor !== '#3b82f6' ? { backgroundColor: primaryColor } : undefined}
                >
                  {text}
                </Link>
              );
            })
          ) : (
            <>
              <Link
                href="#get-started"
                className="rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition"
              >
                Get started
              </Link>
              <Link
                href="#ecosystems"
                className="rounded-xl bg-purple-950/50 border border-purple-500/40 px-7 py-3.5 text-sm font-semibold text-purple-200 backdrop-blur hover:bg-purple-900/60 transition"
              >
                Ecosystems
              </Link>
            </>
          )}
        </div>

        {/* Hero Visual Ribbon / Image Graphic if present */}
        {heroImage?.value?.src && (
          <div className="mt-12 flex justify-center">
            <img
              src={heroImage.value.src}
              alt="Hero Visual Asset"
              className="w-full max-w-4xl rounded-2xl object-cover shadow-2xl"
            />
          </div>
        )}
      </div>
    </section>
  );
}
`;
  }

  private renderFeaturesComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function FeaturesSection({ sectionId, placeholders }: SectionProps) {
  const sectionTitle = placeholders.find(p => p.role.includes('heading') || p.role.includes('title'))?.value || 'Key Features';
  const sectionSubtitle = placeholders.find(p => p.role.includes('desc') || p.role.includes('sub'))?.value || 'Everything you need to scale effortlessly and create extraordinary digital experiences.';
  const featureItems = placeholders.filter(p => p.role.includes('item') || p.role.includes('feature') || p.type === 'text');

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-900/30 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {typeof sectionTitle === 'string' ? sectionTitle : 'Feature Highlights'}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            {typeof sectionSubtitle === 'string' ? sectionSubtitle : 'Engineered with cutting-edge standards and responsive modularity.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureItems.length > 0 ? (
            featureItems.slice(0, 6).map((item, idx) => (
              <div key={item.id || idx} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-3 shadow transition hover:border-zinc-700">
                <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {idx + 1}
                </div>
                <h3 className="font-semibold text-white text-base">
                  {item.content_hint || item.role || \`Feature \${idx + 1}\`}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {typeof item.value === 'string' ? item.value : 'Optimized for modern workflows, providing fast load times and clean semantic structure.'}
                </p>
              </div>
            ))
          ) : (
            [1, 2, 3].map(n => (
              <div key={n} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {n}
                </div>
                <h3 className="font-semibold text-white text-base">Modular Architecture {n}</h3>
                <p className="text-xs text-zinc-400">High speed, accessible layout, and responsive styles designed from clean semantic foundations.</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderServicesComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function ServicesSection({ sectionId, placeholders }: SectionProps) {
  const title = placeholders.find(p => p.role.includes('title') || p.role.includes('heading'))?.value || 'Our Services';
  const subtitle = placeholders.find(p => p.role.includes('desc') || p.role.includes('sub'))?.value || 'Comprehensive solutions tailored to elevate your business performance.';

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-950 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {typeof title === 'string' ? title : 'Services & Capabilities'}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            {typeof subtitle === 'string' ? subtitle : 'Delivering high-impact results with precision and speed.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {['Strategic Consulting', 'Full-Stack Engineering', 'Design Systems'].map((srv, i) => (
            <div key={srv} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 space-y-4 hover:border-indigo-500/40 transition">
              <div className="text-2xl">✨</div>
              <h3 className="text-lg font-bold text-white">{srv}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                End-to-end execution combining modern architectural standards with intuitive user experiences.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderAboutComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function AboutSection({ sectionId, placeholders }: SectionProps) {
  const title = placeholders.find(p => p.role.includes('title') || p.role.includes('heading'))?.value || 'About Our Mission';
  const story = placeholders.find(p => p.role.includes('body') || p.role.includes('desc') || p.role.includes('story'))?.value || 'We are dedicated to building fast, maintainable, and visually striking digital web solutions that empower creators and organizations worldwide.';
  const aboutImage = placeholders.find(p => p.type === 'image');

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-900/20 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {typeof title === 'string' ? title : 'About Us'}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              {typeof story === 'string' ? story : 'Built from first principles, our engineering focuses on speed, accessibility, and modular design components.'}
            </p>
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
              <div>
                <div className="text-2xl font-extrabold text-indigo-400">99.9%</div>
                <div className="text-xs text-zinc-500 mt-1">Uptime & Reliability</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-emerald-400">100%</div>
                <div className="text-xs text-zinc-500 mt-1">Type-Safe Next.js Code</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            {aboutImage?.value?.src ? (
              <img
                src={aboutImage.value.src}
                alt="About Visual"
                className="rounded-2xl border border-zinc-800 object-cover max-h-[380px] w-full shadow-xl"
              />
            ) : (
              <div className="aspect-square w-full max-w-md rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-600 text-xs">
                About Media Placeholder
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderTestimonialsComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function TestimonialsSection({ sectionId, placeholders }: SectionProps) {
  const heading = placeholders.find(p => p.role.includes('title') || p.role.includes('heading'))?.value || 'What People Say';

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-950 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {typeof heading === 'string' ? heading : 'Trusted Globally'}
          </h2>
          <p className="text-zinc-400 text-sm mt-2">Hear directly from clients and engineers who build with our platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { quote: 'The generated layout matched our design specifications with zero unnecessary overhead.', author: 'Alex Morgan', role: 'Head of Product' },
            { quote: 'Deterministic component output saved us days of boilerplate frontend work.', author: 'Sarah Chen', role: 'Staff Frontend Engineer' },
            { quote: 'Crisp, modern, and perfectly organized TypeScript codebase ready for production.', author: 'David Ross', role: 'Tech Lead' },
          ].map((t, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4 flex flex-col justify-between">
              <p className="text-xs text-zinc-300 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <div className="text-xs font-semibold text-white">{t.author}</div>
                <div className="text-[11px] text-zinc-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderPricingComponentTemplate(): string {
    return `import React from 'react';
import Link from 'next/link';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function PricingSection({ sectionId, placeholders }: SectionProps) {
  const heading = placeholders.find(p => p.role.includes('title') || p.role.includes('heading'))?.value || 'Simple, Transparent Pricing';

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-900/30 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {typeof heading === 'string' ? heading : 'Pricing Plans'}
          </h2>
          <p className="text-zinc-400 text-sm mt-2">Flexible plans designed for teams of any scale.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {[
            { name: 'Starter', price: '$29', desc: 'Essential toolset for individual creators', popular: false },
            { name: 'Professional', price: '$79', desc: 'Advanced features and high scalability', popular: true },
            { name: 'Enterprise', price: '$199', desc: 'Dedicated support and custom integrations', popular: false },
          ].map(plan => (
            <div key={plan.name} className={\`rounded-2xl border p-8 flex flex-col justify-between \${plan.popular ? 'border-indigo-500 bg-zinc-900 shadow-2xl ring-1 ring-indigo-500' : 'border-zinc-800 bg-zinc-950'}\`}>
              <div className="space-y-4">
                {plan.popular && <span className="rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider">Most Popular</span>}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="text-3xl font-extrabold text-white">{plan.price}<span className="text-xs text-zinc-500 font-normal"> / mo</span></div>
                <p className="text-xs text-zinc-400">{plan.desc}</p>
              </div>

              <div className="pt-8">
                <Link href="#contact" className={\`block text-center rounded-xl py-2.5 text-xs font-semibold transition \${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}\`}>
                  Get Started
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderGalleryComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function GallerySection({ sectionId, placeholders }: SectionProps) {
  const images = placeholders.filter(p => p.type === 'image');

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-950 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white mb-10 text-center">Visual Showcase</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.length > 0 ? (
            images.map((img, idx) => (
              <div key={img.id || idx} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 aspect-video flex items-center justify-center">
                {img.value?.src ? (
                  <img src={img.value.src} alt={img.role || 'Gallery Item'} className="h-full w-full object-cover transition hover:scale-105 duration-300" />
                ) : (
                  <span className="text-xs text-zinc-600">Image Asset #{idx + 1}</span>
                )}
              </div>
            ))
          ) : (
            [1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 aspect-video flex items-center justify-center text-xs text-zinc-600">
                Gallery Item #{n}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderContactComponentTemplate(): string {
    return `import React from 'react';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function ContactSection({ sectionId, placeholders }: SectionProps) {
  const title = placeholders.find(p => p.role.includes('title') || p.role.includes('heading'))?.value || 'Get In Touch';

  return (
    <section id={sectionId} className="border-t border-zinc-850 bg-zinc-900/40 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center space-y-3 mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-white">{typeof title === 'string' ? title : 'Contact Us'}</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Have questions or want to collaborate? Send us a message and our team will get back to you promptly.</p>
        </div>

        <form className="max-w-xl mx-auto space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Your Name</label>
            <input type="text" placeholder="Jane Doe" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address</label>
            <input type="email" placeholder="jane@example.com" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Message</label>
            <textarea rows={4} placeholder="How can we assist you?" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
          </div>
          <button type="button" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-500">
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}
`;
  }

  private renderFooterComponentTemplate(): string {
    return `import React from 'react';
import Link from 'next/link';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function FooterSection({ sectionId, placeholders }: SectionProps) {
  const copyright = placeholders.find(p => p.role.includes('copy'))?.value || \`© \${new Date().getFullYear()} All rights reserved.\`;
  const links = placeholders.filter(p => p.type === 'link');

  return (
    <footer id={sectionId} className="border-t border-zinc-800 bg-zinc-950 py-12 text-zinc-400">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-xs">
          {typeof copyright === 'string' ? copyright : \`© \${new Date().getFullYear()} All rights reserved.\`}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          {links.length > 0 ? (
            links.map(l => {
              const text = typeof l.value === 'object' && l.value?.text ? l.value.text : typeof l.value === 'string' ? l.value : l.content_hint || 'Link';
              const href = typeof l.value === 'object' && l.value?.url ? l.value.url : '#';
              return (
                <Link key={l.id} href={href} className="hover:text-white transition">
                  {text}
                </Link>
              );
            })
          ) : (
            <>
              <Link href="#" className="hover:text-white transition">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition">Terms of Service</Link>
              <Link href="#" className="hover:text-white transition">Status</Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
`;
  }

  private renderGenericComponentTemplate(sectionType: string): string {
    return `import React from 'react';
import Link from 'next/link';

interface SectionProps {
  sectionId: string;
  bounds: { x: number; y: number; width: number; height: number };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: any;
  }>;
}

export function GenericSection({ sectionId, bounds, placeholders }: SectionProps) {
  return (
    <section
      id={sectionId}
      className="border-t border-zinc-850 bg-zinc-950/70 py-16 text-zinc-100"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-xl font-bold tracking-tight text-white capitalize">
            ${this.escapeJsString(sectionType)} Section
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">
            {bounds.width} × {bounds.height}px
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {placeholders.map((ph) => {
            const hasVal = ph.value !== null && ph.value !== undefined && ph.value !== '';
            return (
              <div
                key={ph.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 capitalize">{ph.role}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {ph.type}
                  </span>
                </div>

                {ph.type === 'text' && (
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {hasVal ? String(ph.value) : (ph.content_hint || 'Custom text block')}
                  </p>
                )}

                {ph.type === 'image' && (
                  <div className="mt-2 aspect-video overflow-hidden rounded-lg bg-zinc-950 flex items-center justify-center">
                    {ph.value?.src ? (
                      <img src={ph.value.src} alt={ph.role} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-zinc-600">Image Asset ({ph.role})</span>
                    )}
                  </div>
                )}

                {ph.type === 'button' && (
                  <div className="pt-2">
                    <Link
                      href={typeof ph.value === 'object' && ph.value?.url ? ph.value.url : '#'}
                      className="inline-block rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                    >
                      {typeof ph.value === 'object' && ph.value?.text ? ph.value.text : (ph.content_hint || 'Action')}
                    </Link>
                  </div>
                )}

                {ph.type === 'link' && (
                  <div className="pt-1">
                    <Link
                      href={typeof ph.value === 'object' && ph.value?.url ? ph.value.url : '#'}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                    >
                      {typeof ph.value === 'object' && ph.value?.text ? ph.value.text : (ph.content_hint || 'Link')}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private renderEnvExample(): string {
    return `# Generated Next.js Project Environment Configuration
NEXT_PUBLIC_SITE_NAME="My Generated Website"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
`;
  }

  private renderReadme(ctx: GenerationContext): string {
    return `# ${ctx.designName}

This website was generated from the structured visual design analysis and user-configured placeholder values.

## Technology Stack
- **Framework**: [Next.js (App Router)](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

## Getting Started

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Run the Development Server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser to view the site.

### 3. Build for Production
\`\`\`bash
npm run build
npm run start
\`\`\`

## Architecture & Layout Structure
- \`app/layout.tsx\`: Root application layout and global metadata.
- \`app/page.tsx\`: Home page rendering semantic design sections in chronological order.
- \`components/sections/\`: Modular, accessible React section components (${ctx.layout.sections.length} sections generated).
- \`public/assets/\`: User content image assets (${ctx.assets.length} assets bundled).

---
*Generated deterministically by the Website Generation Engine.*
`;
  }

  private escapeJsString(str: string): string {
    return (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}
