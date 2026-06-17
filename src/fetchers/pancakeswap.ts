import { fetchJson, normalizeEvm, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { EVM_CHAIN_IDS } from '../types.js';

interface PancakeTokenList {
  tokens: Array<{
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
  }>;
}

const URLS = [
  'https://tokens.pancakeswap.finance/pancakeswap-extended.json',
  'https://tokens.pancakeswap.finance/pancakeswap-default.json',
];

export const pancakeSwapSource: TokenSource = {
  id: 'pancakeswap',
  description: 'PancakeSwap token lists',

  async fetch() {
    log('→ PancakeSwap');

    const results = await Promise.all(
      URLS.map((url, i) => fetchJson<PancakeTokenList>(url, `PancakeSwap list ${i + 1}`)),
    );

    const seen = new Set<string>();
    const tokens: Token[] = [];

    for (const data of results) {
      if (!data?.tokens?.length) continue;
      for (const t of data.tokens) {
        if (!EVM_CHAIN_IDS.has(t.chainId)) continue;
        const key = `${t.chainId}:${t.address.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const n = normalizeEvm(t, t.chainId, this.id);
        if (n) tokens.push(n);
      }
    }

    log(`  ✓ PancakeSwap: ${tokens.length} tokens`);
    return tokens;
  },
};
