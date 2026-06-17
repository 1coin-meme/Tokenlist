import { fetchJson, normalizeEvm, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { EVM_CHAIN_IDS } from '../types.js';

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

    const tokens = data.tokens
      .filter(t => EVM_CHAIN_IDS.has(t.chainId))
      .map(t => normalizeEvm(t, t.chainId, this.id))
      .filter((t): t is Token => t !== null);

    log(`  ✓ Uniswap: ${tokens.length} tokens`);
    return tokens;
  },
};
