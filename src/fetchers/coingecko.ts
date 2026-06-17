import { fetchJson, normalizeEvm, normalizeSolana, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';
import { EVM_CHAIN_IDS, SOLANA_CHAIN_ID } from '../types.js';

interface CoinGeckoTokenList {
  tokens: Array<{
    chainId?: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
  }>;
}

const SOURCES = [
  { url: 'https://tokens.coingecko.com/uniswap/all.json',             defaultChainId: 1 },
  { url: 'https://tokens.coingecko.com/binance-smart-chain/all.json', defaultChainId: 56 },
  { url: 'https://tokens.coingecko.com/base/all.json',                defaultChainId: 8453 },
  { url: 'https://tokens.coingecko.com/solana/all.json',              defaultChainId: SOLANA_CHAIN_ID },
];

export const coinGeckoSource: TokenSource = {
  id: 'coingecko',
  description: 'CoinGecko token lists',

  async fetch() {
    log('→ CoinGecko');

    const results = await Promise.all(
      SOURCES.map(s => fetchJson<CoinGeckoTokenList>(s.url, `CoinGecko ${s.url.split('/').at(-2)}`)),
    );

    const tokens: Token[] = [];

    for (let i = 0; i < SOURCES.length; i++) {
      const data = results[i];
      const { defaultChainId } = SOURCES[i]!;
      if (!data?.tokens?.length) continue;

      for (const t of data.tokens) {
        const chainId = t.chainId ?? defaultChainId;
        if (chainId === SOLANA_CHAIN_ID) {
          const n = normalizeSolana(t, this.id);
          if (n) tokens.push(n);
        } else if (EVM_CHAIN_IDS.has(chainId)) {
          const n = normalizeEvm(t, chainId, this.id);
          if (n) tokens.push(n);
        }
      }
    }

    log(`  ✓ CoinGecko: ${tokens.length} tokens`);
    return tokens;
  },
};
