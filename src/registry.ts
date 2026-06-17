import type { TokenSource } from './types.js';
import { uniswapSource }     from './fetchers/uniswap.js';
import { pancakeSwapSource } from './fetchers/pancakeswap.js';
import { coinGeckoSource }   from './fetchers/coingecko.js';
import { oneInchSource }     from './fetchers/oneinch.js';
import { jupiterSource }     from './fetchers/jupiter.js';
import { oneMemeSource }     from './fetchers/onememe.js';
import { dexScreenerSource } from './fetchers/dexscreener.js';
import { dflowSource }       from './fetchers/dflow.js';

/**
 * Default set of token sources shipped with 1list.
 * Pass a filtered or extended copy to runPipeline() to customise behaviour:
 *
 *   // add a custom source
 *   const sources = [...defaultSources, mySource];
 *
 *   // remove a source
 *   const sources = defaultSources.filter(s => s.id !== 'jupiter');
 */
export const defaultSources: TokenSource[] = [
  uniswapSource,
  pancakeSwapSource,
  coinGeckoSource,
  oneInchSource,
  jupiterSource,
  oneMemeSource,
  dexScreenerSource,
  dflowSource,
];
