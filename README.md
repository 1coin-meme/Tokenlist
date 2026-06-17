# 1list

Aggregated token lists for **Ethereum**, **BNB Smart Chain**, **Base**, and **Solana** — sourced from Uniswap, PancakeSwap, CoinGecko, 1inch, and Jupiter.

## Token lists

| File | Chain | Tokens |
|------|-------|--------|
| `lists/ethereum.tokenlist.json` | Ethereum (chainId: 1) | ~5 000 |
| `lists/bsc.tokenlist.json` | BNB Smart Chain (chainId: 56) | ~3 700 |
| `lists/base.tokenlist.json` | Base (chainId: 8453) | ~2 400 |
| `lists/solana.tokenlist.json` | Solana (chainId: 101) | ~5 900 |
| `lists/all.tokenlist.json` | All chains combined | ~17 000 |

## Format

All EVM lists follow the [Uniswap Token List standard](https://uniswap.org/tokenlist.schema.json):

```json
{
  "name": "1list Ethereum",
  "timestamp": "2026-06-17T07:32:00.000Z",
  "version": { "major": 1, "minor": 0, "patch": 0 },
  "tokens": [
    {
      "chainId": 1,
      "address": "0x111111111117dC0aa78b770fA6A738034120C302",
      "name": "1inch",
      "symbol": "1INCH",
      "decimals": 18,
      "logoURI": "https://...",
      "tags": ["defi"],
      "extensions": {
        "sources": ["uniswap", "coingecko", "1inch"]
      }
    }
  ]
}
```

The Solana list uses the same structure with `chainId: 101` and base58 addresses.

## Sources

| Source | Chains |
|--------|--------|
| [Uniswap](https://tokens.uniswap.org/) | Ethereum |
| [PancakeSwap](https://tokens.pancakeswap.finance/) | Ethereum, BSC |
| [CoinGecko](https://tokens.coingecko.com/) | Ethereum, BSC, Base, Solana |
| [1inch](https://tokens.1inch.io/) | Ethereum, BSC, Base |
| [Jupiter](https://token.jup.ag/) | Solana |
| [OneMEME Launchpad](https://github.com/timedbase/OneMEMELaunchpad-Subgraph) | Ethereum, BSC |

Tokens that appear in multiple sources are **deduplicated** — their `extensions.sources` array lists every source they were found in. OneMEME tokens carry extra metadata: `extensions.tokenType` (`STANDARD` / `TAX` / `REFLECTION`) and `extensions.migrated`, plus the tags `meme`, `1meme`, and `migrated` (once graduated to a DEX).

## Regenerating the lists

```bash
npm run build
```

Requires Node.js >= 18. No external dependencies — uses the native `fetch` API.

### OneMEME subgraph endpoints

The OneMEME subgraph query URLs can be overridden via environment variables — useful when Studio shows a dev query URL that includes your API key:

```bash
ONEMEME_ETH_URL="https://api.studio.thegraph.com/query/.../one-meme-eth/version/latest" \
ONEMEME_BSC_URL="https://api.studio.thegraph.com/query/.../onememe-launchpad/version/latest" \
npm run build
```
