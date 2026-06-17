import { normalizeSolana, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { SOLANA_CHAIN_ID } from '../types.js';

interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

const DFLOW_PROD = 'https://quote-api.dflow.net/tokens';
const DFLOW_DEV  = 'https://dev-quote-api.dflow.net/tokens';
const JUPITER_STRICT = 'https://token.jup.ag/strict';

async function get<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': '1list/1.0', ...headers },
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      log(`  ✗ DFlow (${url}): HTTP ${res.status}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    log(`  ✗ DFlow: ${(err as Error).message}`);
    return null;
  }
}

export const dflowSource: TokenSource = {
  id: 'dflow',
  description: 'DFlow Solana token list (intersection with Jupiter metadata)',

  async fetch() {
    log('→ DFlow');

    const apiKey = process.env['DFLOW_API_KEY'];
    const dflowUrl = apiKey ? DFLOW_PROD : DFLOW_DEV;
    const dflowHeaders = apiKey ? { 'x-api-key': apiKey } : undefined;

    const [addresses, jupiterTokens] = await Promise.all([
      get<string[]>(dflowUrl, dflowHeaders),
      get<JupiterToken[]>(JUPITER_STRICT),
    ]);

    if (!addresses?.length || !jupiterTokens?.length) {
      log(`  ✓ DFlow: 0 tokens`);
      return [];
    }

    const dflowSet = new Set(addresses);
    const tokens: Token[] = [];

    for (const raw of jupiterTokens) {
      if (!raw.address || !dflowSet.has(raw.address)) continue;
      const token = normalizeSolana({ ...raw }, this.id);
      if (token) tokens.push(token);
    }

    const solana = tokens.filter(t => t.chainId === SOLANA_CHAIN_ID).length;
    log(`  ✓ DFlow: ${tokens.length} tokens (${solana} Solana)`);
    return tokens;
  },
};
