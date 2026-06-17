import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchJson, rpcDecimals, normalizeSolana, log, debug } from '../utils.js';
import type { Token, TokenSource, SourceContext } from '../types.js';
import { SOLANA_CHAIN_ID } from '../types.js';

interface DexScreenerConfig {
  chain: string;
  address: string;
  note?: string;
}

interface DexScreenerPair {
  chainId: string;
  baseToken: { address: string; name: string; symbol: string };
  info?: { imageUrl?: string };
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bsc:      56,
  base:     8453,
  solana:   SOLANA_CHAIN_ID,
};

async function loadConfig(root: string): Promise<DexScreenerConfig[]> {
  const raw = await readFile(join(root, 'config', 'dexscreener.json'), 'utf8');
  return JSON.parse(raw) as DexScreenerConfig[];
}

async function buildPairIndex(entries: DexScreenerConfig[]): Promise<Map<string, DexScreenerPair>> {
  const byChain = new Map<string, string[]>();
  for (const e of entries) {
    const list = byChain.get(e.chain) ?? [];
    list.push(e.address);
    byChain.set(e.chain, list);
  }

  const index = new Map<string, DexScreenerPair>();

  for (const [chain, addresses] of byChain) {
    for (let i = 0; i < addresses.length; i += 30) {
      const chunk = addresses.slice(i, i + 30).map(a => a.toLowerCase());
      const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
      const data = await fetchJson<DexScreenerResponse>(url, `DexScreener ${chain}`);
      for (const pair of data?.pairs ?? []) {
        const key = `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`;
        if (!index.has(key)) index.set(key, pair);
      }
    }
  }

  return index;
}

export const dexScreenerSource: TokenSource = {
  id: 'dexscreener',
  description: 'DexScreener (config/dexscreener.json)',

  async fetch(ctx: SourceContext) {
    log('→ DexScreener');

    let entries: DexScreenerConfig[];
    try {
      entries = await loadConfig(ctx.root);
    } catch {
      log('  ✗ DexScreener: config/dexscreener.json not found');
      return [];
    }

    if (!entries.length) {
      log('  ✓ DexScreener: 0 tokens (config empty)');
      return [];
    }

    const pairIndex = await buildPairIndex(entries);
    const tokenJobs: Promise<Token>[] = [];

    for (const e of entries) {
      const chainId = CHAIN_IDS[e.chain];
      if (!chainId) { debug(`Unknown chain: ${e.chain}`); continue; }

      const key = `${e.chain}:${e.address.toLowerCase()}`;
      const pair = pairIndex.get(key);
      if (!pair) { log(`  ✗ DexScreener: no pair for ${e.address}`); continue; }

      const { baseToken, info } = pair;
      const logoURI = info?.imageUrl ?? '';

      if (chainId === SOLANA_CHAIN_ID) {
        tokenJobs.push(Promise.resolve(
          normalizeSolana({ ...baseToken, logoURI, decimals: 9 }, this.id)!,
        ));
      } else {
        tokenJobs.push(
          rpcDecimals(chainId, baseToken.address).then(decimals => ({
            chainId,
            address: baseToken.address,
            name: baseToken.name.trim(),
            symbol: baseToken.symbol.trim(),
            decimals,
            logoURI,
            tags: [],
            extensions: { sources: [this.id] },
          })),
        );
      }
    }

    const tokens = await Promise.all(tokenJobs);
    log(`  ✓ DexScreener: ${tokens.length} tokens`);
    return tokens;
  },
};
