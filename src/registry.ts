import type { TokenSource } from './types.js';
import { uniswapSource }     from './fetchers/uniswap.js';
import { pancakeSwapSource } from './fetchers/pancakeswap.js';
import { coinGeckoSource }   from './fetchers/coingecko.js';
import { oneInchSource }     from './fetchers/oneinch.js';
import { dexScreenerSource } from './fetchers/dexscreener.js';

/**
 * Strict token sources: a token must appear in ALL four core lists for its
 * chain (1inch + Uniswap + PancakeSwap + CoinGecko for EVM; Uniswap +
 * PancakeSwap for Solana).  DexScreener entries always pass through regardless
 * of cross-source coverage.
 */
export const defaultSources: TokenSource[] = [
  uniswapSource,
  pancakeSwapSource,
  coinGeckoSource,
  oneInchSource,
  dexScreenerSource,
];
