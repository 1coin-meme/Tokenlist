import { deduplicate, buildTokenList, log } from './utils.js';
import { CHAINS } from './types.js';
import type { TokenSource, SourceContext, TokenList } from './types.js';

export interface PipelineResult {
  /** Per-chain token lists keyed by slug (ethereum, bsc, base, solana). */
  chains: Record<string, TokenList>;
  /** Single unified list across all chains. */
  unified: TokenList;
}

// A token must appear in ALL of these sources for its chain to be included,
// unless it was explicitly listed in DexScreener (which always gets a free pass).
const REQUIRED_SOURCES: Record<number, string[]> = {
  1:    ['1inch', 'uniswap', 'pancakeswap', 'coingecko'],
  56:   ['1inch', 'uniswap', 'pancakeswap', 'coingecko'],
  8453: ['1inch', 'uniswap', 'pancakeswap', 'coingecko'],
  101:  ['uniswap', 'pancakeswap'],
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
    if (srcs.has('dexscreener')) return true; // explicit allowlist bypass
    const required = REQUIRED_SOURCES[t.chainId];
    if (!required) return false;
    return required.every(s => srcs.has(s));
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
