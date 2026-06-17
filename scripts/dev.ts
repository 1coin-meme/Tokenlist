import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { log } from '../src/utils.js';
import { runPipeline } from '../src/pipeline.js';
import { defaultSources } from '../src/registry.js';
import type { TokenSource } from '../src/types.js';
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

// ─── HTML dashboard ───────────────────────────────────────────────────────────

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;min-height:100vh;padding:2.5rem}
h1{font-size:2rem;font-weight:700;letter-spacing:-.5px}
a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}`;

function renderHtml(s: State, sources: TokenSource[]): [number, string] {
  if (s.status === 'building') {
    return [200, `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="3">
<title>1list — building…</title>
<style>${BASE_CSS}
body{display:flex;align-items:center;justify-content:center}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#f59e0b;margin-right:.5rem;animation:p 1.2s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.2}}
</style></head><body>
<div style="text-align:center">
  <h1><span class="dot"></span>1list</h1>
  <p style="color:#555;margin-top:.5rem">Building token lists…</p>
</div>
</body></html>`];
  }

  if (s.status === 'error') {
    return [500, `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>1list — error</title>
<style>${BASE_CSS}
body{display:flex;align-items:center;justify-content:center}
.err{background:#1a0808;border:1px solid #5a1a1a;border-radius:8px;padding:1rem;font-family:monospace;font-size:.82rem;color:#f87171;margin-top:1rem;white-space:pre-wrap;word-break:break-all}
button{margin-top:1.25rem;padding:.45rem 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.85rem}
button:hover{background:#2563eb}
</style></head><body>
<div style="max-width:520px;width:100%">
  <h1>1list</h1>
  <div class="err">${s.message.replace(/</g, '&lt;')}</div>
  <button onclick="fetch('/rebuild',{method:'POST'}).then(()=>location.reload())">Rebuild</button>
</div>
</body></html>`];
  }

  // Ready state
  const chains = Object.entries(s.result.chains);
  const total  = s.result.unified.tokens.length;

  const chainCards = chains.map(([slug, list]) => `
<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:1.1rem 1.4rem;min-width:130px">
  <div style="font-size:.75rem;color:#777;text-transform:capitalize;margin-bottom:.2rem">${slug}</div>
  <div style="font-size:1.7rem;font-weight:700">${list.tokens.length.toLocaleString()}</div>
  <div style="font-size:.68rem;color:#555;margin:.2rem 0 .7rem">tokens</div>
  <a href="/chains/${slug}" style="font-size:.73rem">JSON</a>
</div>`).join('');

  const sourceTags = sources.map(src =>
    `<span style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:.2rem .5rem;font-size:.73rem;color:#999">${src.id}</span>`
  ).join('');

  const endpointRows = [
    `<li><span style="color:#555">GET</span>  <a href="/">/</a> — unified list</li>`,
    ...chains.map(([slug]) =>
      `<li><span style="color:#555">GET</span>  <a href="/chains/${slug}">/chains/${slug}</a></li>`
    ),
    `<li><span style="color:#555">GET</span>  <a href="/status">/status</a></li>`,
    `<li><span style="color:#555">POST</span> /rebuild</li>`,
  ].join('');

  return [200, `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>1list</title>
<style>${BASE_CSS}
.lbl{font-size:.68rem;letter-spacing:1px;text-transform:uppercase;color:#4b4b4b;margin-bottom:.6rem}
.sec{margin-bottom:2rem}
ul{list-style:none;display:flex;flex-direction:column;gap:.35rem}
li{font-family:monospace;font-size:.8rem;color:#888}
button{padding:.4rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem}
button:hover{background:#2563eb}button:disabled{background:#222;color:#555;cursor:default}
</style></head><body>

<div style="display:flex;align-items:baseline;gap:.85rem;margin-bottom:2rem">
  <h1>1list</h1>
  <span style="color:#555;font-size:.88rem">unified token list</span>
</div>

<div class="sec">
  <div class="lbl">Chains</div>
  <div style="display:flex;gap:.85rem;flex-wrap:wrap">${chainCards}</div>
  <p style="margin-top:.75rem;font-size:.82rem;color:#555">
    ${total.toLocaleString()} total &nbsp;·&nbsp; <a href="/">all.json</a>
  </p>
</div>

<div class="sec">
  <div class="lbl">Sources</div>
  <div style="display:flex;gap:.4rem;flex-wrap:wrap">${sourceTags}</div>
</div>

<div class="sec">
  <div class="lbl">Endpoints</div>
  <ul>${endpointRows}</ul>
</div>

<div style="display:flex;align-items:center;gap:1rem">
  <button id="btn" onclick="rebuild()">Rebuild</button>
  <span style="font-size:.73rem;color:#4b4b4b">Built ${s.builtAt.toLocaleString()}</span>
</div>

<script>
async function rebuild(){
  const btn=document.getElementById('btn');
  btn.disabled=true;btn.textContent='Building…';
  await fetch('/rebuild',{method:'POST'});
  const iv=setInterval(async()=>{
    const r=await fetch('/status').then(r=>r.json()).catch(()=>null);
    if(!r)return;
    if(r.status==='ready'){clearInterval(iv);location.reload();}
    if(r.status==='error'){clearInterval(iv);btn.disabled=false;btn.textContent='Rebuild';alert('Error: '+r.message);}
  },2000);
}
</script>
</body></html>`];
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url      = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method   = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const wantsHtml = (req.headers['accept'] ?? '').includes('text/html');

  // GET / — HTML dashboard for browsers, unified JSON for API clients
  if (pathname === '/' && method === 'GET') {
    if (wantsHtml) {
      const [status, body] = renderHtml(state, defaultSources);
      return htmlRes(res, status, body);
    }
    if (state.status !== 'ready') {
      return json(res, state.status === 'building' ? 503 : 500, { status: state.status });
    }
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
