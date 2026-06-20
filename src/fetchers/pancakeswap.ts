import { fetchJson, normalizeEvm, normalizeSolana, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { EVM_CHAIN_IDS, SOLANA_CHAIN_ID } from '../types.js';

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

const EVM_URLS = [
  'https://tokens.pancakeswap.finance/pancakeswap-default.json',
];

const SOLANA_URLS = [
  'https://tokens.pancakeswap.finance/pancakeswap-solana-default.json',
];

export const pancakeSwapSource: TokenSource = {
  id: 'pancakeswap',
  description: 'PancakeSwap token lists (EVM + Solana)',

  async fetch() {
    log('→ PancakeSwap');

    const [evmResults, solanaResults] = await Promise.all([
      Promise.all(EVM_URLS.map((url, i) => fetchJson<PancakeTokenList>(url, `PancakeSwap EVM ${i + 1}`))),
      Promise.all(SOLANA_URLS.map((url, i) => fetchJson<PancakeTokenList>(url, `PancakeSwap Solana ${i + 1}`))),
    ]);

    const seen = new Set<string>();
    const tokens: Token[] = [];

    for (const data of evmResults) {
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

    for (const data of solanaResults) {
      if (!data?.tokens?.length) continue;
      for (const t of data.tokens) {
        const chainId = t.chainId ?? SOLANA_CHAIN_ID;
        if (chainId !== SOLANA_CHAIN_ID) continue;
        const key = `${SOLANA_CHAIN_ID}:${t.address}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const n = normalizeSolana(t, this.id);
        if (n) tokens.push(n);
      }
    }

    log(`  ✓ PancakeSwap: ${tokens.length} tokens`);
    return tokens;
  },
};
