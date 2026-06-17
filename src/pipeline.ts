import { deduplicate, buildTokenList, log } from './utils.js';
import { CHAINS } from './types.js';
import type { TokenSource, SourceContext, TokenList } from './types.js';

export interface PipelineResult {
  /** Per-chain token lists keyed by slug (ethereum, bsc, base, solana). */
  chains: Record<string, TokenList>;
  /** Single unified list across all chains. */
  unified: TokenList;
}

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

  log(`Total unique tokens: ${allTokens.length}\n`);

  const chains: Record<string, TokenList> = {};

  for (const [slug, { chainId, label }] of Object.entries(CHAINS)) {
    const chainTokens = allTokens.filter(t => t.chainId === chainId);
    log(`${label}: ${chainTokens.length} tokens`);
    chains[slug] = buildTokenList(`1list ${label}`, chainTokens);
  }

  const unified = buildTokenList('1list', allTokens);
  return { chains, unified };
}
