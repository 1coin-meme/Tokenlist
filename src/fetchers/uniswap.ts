import { fetchJson, normalizeEvm, normalizeSolana, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { EVM_CHAIN_IDS, SOLANA_CHAIN_ID } from '../types.js';

interface UniswapTokenList {
  tokens: Array<{
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    tags?: string[];
  }>;
}

export const uniswapSource: TokenSource = {
  id: 'uniswap',
  description: 'Uniswap token list',

  async fetch() {
    log('→ Uniswap');

    const data = await fetchJson<UniswapTokenList>('https://tokens.uniswap.org/', 'Uniswap');
    if (!data?.tokens?.length) return [];

    const tokens: Token[] = [];
    for (const t of data.tokens) {
      if (t.chainId === SOLANA_CHAIN_ID) {
        const n = normalizeSolana(t, this.id);
        if (n) tokens.push(n);
      } else if (EVM_CHAIN_IDS.has(t.chainId)) {
        const n = normalizeEvm(t, t.chainId, this.id);
        if (n) tokens.push(n);
      }
    }

    log(`  ✓ Uniswap: ${tokens.length} tokens`);
    return tokens;
  },
};
