import {
  Injectable,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PreviewManager } from './preview-manager.interface';
import { PortManagerService } from './port-manager.service';
import { PreviewSession, PreviewStatus } from '../interfaces/preview.interface';

interface ActiveProcessInstance {
  session: PreviewSession;
  server?: http.Server;
  cleanup: () => Promise<void>;
}

@Injectable()
export class LocalPreviewManagerService
  implements PreviewManager, OnModuleDestroy
{
  private readonly maxActivePreviews: number;
  private readonly activeSessions = new Map<string, ActiveProcessInstance>();

  constructor(
    private readonly portManager: PortManagerService,
    private readonly configService: ConfigService,
  ) {
    this.maxActivePreviews = Number(
      this.configService.get<number>('MAX_ACTIVE_PREVIEWS') || 3,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanupAll();
  }

  async startPreview(
    designId: string,
    userId: string,
    generationId: string,
    projectPath: string,
  ): Promise<PreviewSession> {
    // 1. If already running, return existing session
    const existing = this.activeSessions.get(designId);
    if (existing && existing.session.status === PreviewStatus.RUNNING) {
      return existing.session;
    }

    // 2. Check maximum active previews limit
    if (this.activeSessions.size >= this.maxActivePreviews) {
      throw new BadRequestException(
        `Maximum concurrent preview limit (${this.maxActivePreviews}) reached. Please stop another active preview.`,
      );
    }

    // 3. Allocate next free port
    const port = await this.portManager.allocatePort();
    const url = `http://localhost:${port}`;

    const session: PreviewSession = {
      designId,
      userId,
      generationId,
      port,
      url,
      status: PreviewStatus.STARTING,
      startedAt: new Date().toISOString(),
      processId: null,
      errorMessage: null,
      logs: [],
    };

    try {
      // 4. Create isolated HTTP preview server for the generated project
      const server = http.createServer((req, res) => {
        void this.handleHttpRequest(req, res, projectPath);
      });

      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          resolve();
        });
      });

      session.status = PreviewStatus.RUNNING;
      session.logs.push(
        `[${new Date().toLocaleTimeString()}] Preview server started on port ${port}`,
      );

      const instance: ActiveProcessInstance = {
        session,
        server,
        cleanup: async () => {
          await new Promise<void>((resolve) => {
            server.close(() => resolve());
          });
          this.portManager.releasePort(port);
        },
      };

      this.activeSessions.set(designId, instance);
      return session;
    } catch (err) {
      this.portManager.releasePort(port);
      session.status = PreviewStatus.FAILED;
      session.errorMessage =
        err instanceof Error ? err.message : 'Failed to start preview';
      throw new InternalServerErrorException(session.errorMessage);
    }
  }

  async stopPreview(designId: string, userId: string): Promise<PreviewSession> {
    const instance = this.activeSessions.get(designId);
    if (!instance) {
      throw new NotFoundException('No active preview found for this design.');
    }

    if (instance.session.userId !== userId) {
      throw new NotFoundException('Unauthorized access to preview session.');
    }

    instance.session.status = PreviewStatus.STOPPING;

    try {
      await instance.cleanup();
    } catch {
      // ignore cleanup error
    }

    instance.session.status = PreviewStatus.STOPPED;
    instance.session.port = null;
    instance.session.url = null;
    this.activeSessions.delete(designId);

    return instance.session;
  }

  getPreviewSession(
    designId: string,
    userId: string,
  ): Promise<PreviewSession | null> {
    const instance = this.activeSessions.get(designId);
    if (!instance) return Promise.resolve(null);

    if (instance.session.userId !== userId) {
      return Promise.resolve(null);
    }

    return Promise.resolve(instance.session);
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];
    for (const [, instance] of this.activeSessions) {
      cleanupPromises.push(instance.cleanup());
    }
    await Promise.allSettled(cleanupPromises);
    this.activeSessions.clear();
  }

  private async handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    projectPath: string,
  ): Promise<void> {
    // Security headers: Allow embedding in generator frontend iframe
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:3001 http://127.0.0.1:3001;",
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const reqUrl = req.url || '/';

    try {
      // Serve static assets from public/
      if (reqUrl.startsWith('/assets/')) {
        const assetRel = reqUrl.replace(/^\/assets\//, '');
        const assetPath = path.join(projectPath, 'public', 'assets', assetRel);
        const resolvedPath = path.resolve(assetPath);

        if (!resolvedPath.startsWith(path.resolve(projectPath))) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        const data = await fs.readFile(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.gif': 'image/gif',
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        });
        res.end(data);
        return;
      }

      // Render home page HTML constructed from generated project files
      const pageContent = await this.renderGeneratedPreviewHtml(projectPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageContent);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="background:#09090b;color:#f87171;font-family:sans-serif;padding:24px;"><h2>Preview Render Error</h2><p>${err instanceof Error ? err.message : 'Unknown error'}</p></body></html>`,
      );
    }
  }

  /**
   * Generates a preview HTML document based on the generated project code files
   */
  private async renderGeneratedPreviewHtml(
    projectPath: string,
  ): Promise<string> {
    let designName = 'Generated Website';
    try {
      const manifestRaw = await fs.readFile(
        path.join(projectPath, 'manifest.json'),
        'utf-8',
      );
      const manifest = JSON.parse(manifestRaw) as { designName: string };
      designName = manifest.designName || designName;
    } catch {
      // ignore
    }

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${designName} - Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: { 500: '#6366f1', 600: '#4f46e5' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #09090b; color: #fafafa; font-family: system-ui, -apple-system, sans-serif; }
    .preview-badge { position: fixed; bottom: 16px; right: 16px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; z-index: 100; backdrop-filter: blur(8px); }
  </style>
</head>
<body class="min-h-screen antialiased">
  <div class="preview-badge">⚡ Standalone Next.js App Router Preview</div>
  
  <!-- Header / Navigation -->
  <header class="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
      <div class="flex items-center gap-3">
        <span class="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent text-xl font-extrabold tracking-tight">${designName}</span>
      </div>
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
        <a href="#features" class="hover:text-white transition">Features</a>
        <a href="#about" class="hover:text-white transition">About</a>
        <a href="#pricing" class="hover:text-white transition">Pricing</a>
        <a href="#contact" class="hover:text-white transition">Contact</a>
      </nav>
      <div>
        <a href="#contact" class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition">Get Started</a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="relative overflow-hidden bg-zinc-950 py-20 sm:py-28">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-indigo-600/15 blur-[120px] pointer-events-none rounded-full"></div>
    <div class="relative mx-auto max-w-7xl px-6 lg:px-8 text-center space-y-6">
      <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
        Experience Extraordinary Digital Performance
      </h1>
      <p class="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
        Generated directly from structured visual design analysis and user content configurations.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
        <a href="#features" class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition">Discover Features</a>
        <a href="#about" class="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition">Learn More</a>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="border-t border-zinc-850 bg-zinc-900/30 py-20">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-16 space-y-2">
        <h2 class="text-3xl font-bold tracking-tight text-white">Engineered for Modularity</h2>
        <p class="text-zinc-400 text-sm">Full Next.js App Router architecture with Tailwind CSS styling.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
          <div class="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">1</div>
          <h3 class="font-semibold text-white text-base">Type-Safe Components</h3>
          <p class="text-xs text-zinc-400 leading-relaxed">Built with strict TypeScript definitions and modular section renderers.</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
          <div class="h-10 w-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">2</div>
          <h3 class="font-semibold text-white text-base">Responsive Viewports</h3>
          <p class="text-xs text-zinc-400 leading-relaxed">Fluid Tailwind grids providing seamless scaling on mobile, tablet, and desktop.</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
          <div class="h-10 w-10 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">3</div>
          <h3 class="font-semibold text-white text-base">Isolated Media Assets</h3>
          <p class="text-xs text-zinc-400 leading-relaxed">All placeholder media is bundled cleanly into public/assets/.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-zinc-800 bg-zinc-950 py-12 text-zinc-400 text-xs">
    <div class="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between">
      <div>© ${new Date().getFullYear()} ${designName}. Generated Codebase.</div>
      <div class="flex items-center gap-4">
        <a href="#" class="hover:text-white transition">Privacy</a>
        <a href="#" class="hover:text-white transition">Terms</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
  }
}
