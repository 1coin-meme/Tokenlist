import { fetchJson, normalizeSolana, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';

interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

export const jupiterSource: TokenSource = {
  id: 'jupiter',
  description: 'Jupiter Solana token list',

  async fetch() {
    log('→ Jupiter');

    const strict = await fetchJson<JupiterToken[]>('https://token.jup.ag/strict', 'Jupiter strict');

    const seen = new Set<string>();
    const tokens: Token[] = [];

    for (const raw of (strict ?? [])) {
      if (!raw.address || seen.has(raw.address)) continue;
      seen.add(raw.address);
      const n = normalizeSolana({ ...raw }, this.id);
      if (n) tokens.push(n);
    }

    log(`  ✓ Jupiter: ${tokens.length} tokens`);
    return tokens;
  },
};
