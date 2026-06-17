import { graphqlPost, resolveIpfsUrl, log } from '../utils.js';
import type { Token, TokenSource } from '../types.js';

interface SubgraphToken {
  id: string;
  name: string | null;
  symbol: string | null;
  image: string | null;
  tokenType: string;
  migrated: boolean;
}

interface SubgraphResult {
  tokens: SubgraphToken[];
}

const ENDPOINTS = [
  {
    chainId: 1,
    url: () => process.env['ONEMEME_ETH_URL'] ??
      'https://api.studio.thegraph.com/query/1747858/one-meme-eth/version/latest',
    label: 'OneMEME ETH',
  },
  {
    chainId: 56,
    url: () => process.env['ONEMEME_BSC_URL'] ??
      'https://api.studio.thegraph.com/query/1747858/onememe-launchpad/v0.1.2',
    label: 'OneMEME BSC',
  },
];

async function fetchSubgraph(chainId: number, url: string, label: string, sourceId: string): Promise<Token[]> {
  const PAGE = 1000;
  const tokens: Token[] = [];
  let lastId = '';

  while (true) {
    const query = `{
      tokens(first: ${PAGE}, orderBy: id, orderDirection: asc,
             where: { id_gt: "${lastId}", name_not: null, symbol_not: null }) {
        id name symbol image tokenType migrated
      }
    }`;

    const data = await graphqlPost<SubgraphResult>(url, query, label);
    if (!data?.tokens?.length) break;

    for (const t of data.tokens) {
      if (!t.name || !t.symbol) continue;
      tokens.push({
        chainId,
        address: t.id,
        name: t.name.trim(),
        symbol: t.symbol.trim(),
        decimals: 18,
        logoURI: resolveIpfsUrl(t.image ?? ''),
        tags: ['meme', '1meme', ...(t.migrated ? ['migrated'] : [])],
        extensions: {
          sources: [sourceId],
          tokenType: t.tokenType,
          migrated: t.migrated,
        },
      });
    }

    if (data.tokens.length < PAGE) break;
    lastId = data.tokens.at(-1)!.id;
  }

  return tokens;
}

export const oneMemeSource: TokenSource = {
  id: '1meme',
  description: 'OneMEME Launchpad (The Graph subgraph)',

  async fetch() {
    log('→ OneMEME Launchpad');

    const results = await Promise.all(
      ENDPOINTS.map(e => fetchSubgraph(e.chainId, e.url(), e.label, this.id)),
    );

    const tokens = results.flat();
    log(`  ✓ OneMEME: ${tokens.length} tokens`);
    return tokens;
  },
};
