import { deduplicate, buildTokenList, log } from './utils.js';
import { CHAINS } from './types.js';
import type { TokenSource, SourceContext, TokenList } from './types.js';

export interface PipelineResult {
  /** Per-chain token lists keyed by slug (ethereum, bsc, base, solana). */
  chains: Record<string, TokenList>;
  /** Single unified list across all chains. */
  unified: TokenList;
}

// EVM tokens must appear in at least 3 of the 4 candidate sources for their
// chain; Solana tokens must appear in both. DexScreener always bypasses the filter.
const CHAIN_FILTER: Record<number, { sources: string[]; min: number }> = {
  1:    { sources: ['1inch', 'uniswap', 'pancakeswap', 'coingecko'], min: 3 },
  56:   { sources: ['1inch', 'uniswap', 'pancakeswap', 'coingecko'], min: 3 },
  8453: { sources: ['1inch', 'uniswap', 'pancakeswap', 'coingecko'], min: 3 },
  101:  { sources: ['uniswap', 'pancakeswap', 'jupiter', 'coingecko'], min: 2 },
};

export async function runPipeline(
  sources: TokenSource[],
  ctx: SourceContext,
): Promise<PipelineResult> {
  const results = await Promise.all(
    sources.map(s =>
      s.fetch(ctx).catch(err => {
        log(`  ✗ ${s.id}: ${(err as Error).message}`);
        return [];
      }),
    ),
  );

  log('');

  const allTokens = deduplicate(results.flat());

  const strictTokens = allTokens.filter(t => {
    const srcs = new Set(t.extensions.sources);
    if (srcs.has('dexscreener') || srcs.has('onememe')) return true; // explicit allowlist bypass
    const filter = CHAIN_FILTER[t.chainId];
    if (!filter) return false;
    return filter.sources.filter(s => srcs.has(s)).length >= filter.min;
  });

  log(`Total unique tokens (before strict filter): ${allTokens.length}`);
  log(`Total unique tokens (after strict filter):  ${strictTokens.length}\n`);

  const chains: Record<string, TokenList> = {};

  for (const [slug, { chainId, label }] of Object.entries(CHAINS)) {
    const chainTokens = strictTokens.filter(t => t.chainId === chainId);
    log(`${label}: ${chainTokens.length} tokens`);
    chains[slug] = buildTokenList(`1list ${label}`, chainTokens);
  }

  const unified = buildTokenList('1list', strictTokens);
  return { chains, unified };
}
