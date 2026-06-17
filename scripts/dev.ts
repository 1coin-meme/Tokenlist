import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { log } from '../src/utils.js';
import { runPipeline } from '../src/pipeline.js';
import { defaultSources } from '../src/registry.js';
import type { PipelineResult } from '../src/pipeline.js';

const ROOT = process.cwd();
const PORT = Number(process.env['PORT'] ?? 3000);

// ─── State ────────────────────────────────────────────────────────────────────

type State =
  | { status: 'building' }
  | { status: 'ready';  result: PipelineResult; builtAt: Date }
  | { status: 'error';  message: string };

let state: State = { status: 'building' };
let buildPromise: Promise<void> | null = null;

async function build(): Promise<void> {
  if (buildPromise) return buildPromise;

  buildPromise = (async () => {
    state = { status: 'building' };
    log('\n[pipeline] Running...\n');
    try {
      const result = await runPipeline(defaultSources, { root: ROOT });
      state = { status: 'ready', result, builtAt: new Date() };
      log('\n[pipeline] Done ✓\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state = { status: 'error', message };
      log(`\n[pipeline] Error: ${message}\n`);
    } finally {
      buildPromise = null;
    }
  })();

  return buildPromise;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function tokenListJson(res: ServerResponse, body: unknown): void {
  cors(res);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(body, null, 2));
}

function htmlRes(res: ServerResponse, status: number, body: string): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

// ─── HTML wrapper (browser title only) ───────────────────────────────────────

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title></head><body><pre>${body}</pre></body></html>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url      = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method   = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const wantsHtml = (req.headers['accept'] ?? '').includes('text/html');

  // GET / — titled HTML for browsers, unified JSON for API clients
  if (pathname === '/' && method === 'GET') {
    if (state.status !== 'ready') {
      const msg = state.status === 'building' ? 'Building…' : state.message;
      if (wantsHtml) return htmlRes(res, 200, wrapHtml('1list', msg));
      return json(res, state.status === 'building' ? 503 : 500, { status: state.status });
    }
    const body = JSON.stringify(state.result.unified, null, 2);
    if (wantsHtml) return htmlRes(res, 200, wrapHtml('1list', body));
    return tokenListJson(res, state.result.unified);
  }

  // Guard non-dashboard routes behind ready state
  if (state.status === 'building' && pathname !== '/status') {
    return json(res, 503, { status: 'building', message: 'Pipeline is running, please wait…' });
  }
  if (state.status === 'error' && pathname !== '/status' && pathname !== '/rebuild') {
    return json(res, 500, { status: 'error', message: state.message });
  }

  // GET /status
  if (pathname === '/status' && method === 'GET') {
    if (state.status === 'ready') {
      const counts: Record<string, number> = {};
      for (const [slug, list] of Object.entries(state.result.chains)) {
        counts[slug] = list.tokens.length;
      }
      return json(res, 200, {
        status: 'ready',
        builtAt: state.builtAt,
        tokenCounts: { ...counts, all: state.result.unified.tokens.length },
      });
    }
    return json(res, 200, { status: state.status });
  }

  // GET /chains/:slug
  if (pathname.startsWith('/chains/') && method === 'GET' && state.status === 'ready') {
    const slug = pathname.slice(8);
    const list = state.result.chains[slug];
    if (!list) return json(res, 404, { error: `Unknown chain: ${slug}` });
    return tokenListJson(res, list);
  }

  // POST /rebuild
  if (pathname === '/rebuild' && method === 'POST') {
    build();
    return json(res, 202, { status: 'building', message: 'Pipeline started' });
  }

  json(res, 404, { error: `${method} ${pathname} not found` });
}

// ─── Start ────────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  handler(req, res).catch(err => json(res, 500, { error: (err as Error).message }));
});

server.listen(PORT, async () => {
  console.log(`\n1list dev server  →  http://localhost:${PORT}\n`);
  console.log(`  Sources: ${defaultSources.map(s => s.id).join(', ')}\n`);
  console.log('  GET  /                     dashboard (browser) / unified JSON (API)');
  console.log('  GET  /chains/:slug         per-chain JSON');
  console.log('  GET  /status               build state + token counts');
  console.log('  POST /rebuild              re-run the pipeline');
  console.log('');
  await build();
});
