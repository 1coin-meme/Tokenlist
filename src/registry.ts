import type { TokenSource } from './types.js';
import { uniswapSource }     from './fetchers/uniswap.js';
import { pancakeSwapSource } from './fetchers/pancakeswap.js';
import { coinGeckoSource }   from './fetchers/coingecko.js';
import { oneInchSource }     from './fetchers/oneinch.js';
import { jupiterSource }     from './fetchers/jupiter.js';
import { oneMemeSource }     from './fetchers/onememe.js';
import { dexScreenerSource } from './fetchers/dexscreener.js';

/**
 * EVM tokens (ETH, BSC, Base) must appear in at least 3 of 4 sources:
 * 1inch + Uniswap + PancakeSwap + CoinGecko.
 * Solana tokens must appear in at least 2 of 4 sources:
 * Uniswap + PancakeSwap + Jupiter + CoinGecko.
 * DexScreener entries always pass through regardless of cross-source coverage.
 */
export const defaultSources: TokenSource[] = [
  uniswapSource,
  pancakeSwapSource,
  coinGeckoSource,
  oneInchSource,
  jupiterSource,
  oneMemeSource,
  dexScreenerSource,
];
