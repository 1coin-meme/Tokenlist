import { fetchJson, normalizeEvm, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';

type OneInchResponse = Record<string, {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}> | Array<{
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}>;

const CHAINS = [
  { id: 1,    label: 'ethereum' },
  { id: 56,   label: 'bsc' },
  { id: 8453, label: 'base' },
];

export const oneInchSource: TokenSource = {
  id: '1inch',
  description: '1inch token lists',

  async fetch() {
    log('→ 1inch');

    const results = await Promise.all(
      CHAINS.map(c => fetchJson<OneInchResponse>(
        `https://tokens.1inch.io/v1.2/${c.id}`,
        `1inch ${c.label}`,
      )),
    );

    const tokens: Token[] = [];

    for (let i = 0; i < CHAINS.length; i++) {
      const data = results[i];
      const chainId = CHAINS[i]!.id;
      if (!data) continue;
      const entries = Array.isArray(data) ? data : Object.values(data);
      for (const t of entries) {
        const n = normalizeEvm(t, chainId, this.id);
        if (n) tokens.push(n);
      }
    }

    log(`  ✓ 1inch: ${tokens.length} tokens`);
    return tokens;
  },
};
