import type { Token, TokenList } from './types.js';
import { EVM_CHAIN_IDS, SOLANA_CHAIN_ID } from './types.js';

const VERBOSE = process.env['DEBUG'] === '1';

export const log = (...args: unknown[]): void => { console.log(...args); };
export const debug = (...args: unknown[]): void => {
  if (VERBOSE) console.log('  [debug]', ...args);
};

// ─── HTTP ─────────────────────────────────────────────────────────────────────

export async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  try {
    debug(`GET ${url}`);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': '1list/1.0',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      log(`  ✗ ${label}: HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    log(`  ✗ ${label}: ${(err as Error).message}`);
    return null;
  }
}

export async function graphqlPost<T>(
  url: string,
  query: string,
  label: string,
): Promise<T | null> {
  try {
    debug(`POST ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      log(`  ✗ ${label}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      log(`  ✗ ${label}: ${json.errors[0]!.message}`);
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    log(`  ✗ ${label}: ${(err as Error).message}`);
    return null;
  }
}

// ─── EVM RPC ──────────────────────────────────────────────────────────────────

const EVM_RPC_URLS: Record<number, string> = {
  1:    'https://eth.llamarpc.com',
  56:   'https://bsc-dataseed1.binance.org/',
  8453: 'https://mainnet.base.org',
};

export async function rpcDecimals(chainId: number, address: string): Promise<number> {
  const rpc = EVM_RPC_URLS[chainId];
  if (!rpc) return 18;
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: address.toLowerCase(), data: '0x313ce567' }, 'latest'],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json() as { result?: string };
    if (!json.result || json.result === '0x') return 18;
    return parseInt(json.result, 16);
  } catch {
    return 18;
  }
}

// ─── IPFS ─────────────────────────────────────────────────────────────────────

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

export function resolveIpfsUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('ipfs://')) return IPFS_GATEWAY + raw.slice(7);
  return IPFS_GATEWAY + raw; // bare CID
}

// ─── Normalization ─────────────────────────────────────────────────────────────

export interface RawToken {
  address?: string;
  tokenAddress?: string;
  mint?: string;
  name?: string;
  symbol?: string;
  decimals?: number | string | null;
  decimal?: number | string | null;
  logoURI?: string;
  logoUrl?: string;
  logo?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export function normalizeEvm(raw: RawToken, chainId: number, source: string): Token | null {
  const address = raw.address ?? raw.tokenAddress;
  const decimals = raw.decimals ?? raw.decimal;

  if (!address || !raw.name || !raw.symbol || decimals == null) return null;

  return {
    chainId,
    address,
    name: String(raw.name).trim(),
    symbol: String(raw.symbol).trim(),
    decimals: Number(decimals),
    logoURI: raw.logoURI ?? raw.logoUrl ?? raw.logo ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    extensions: { sources: [source] },
  };
}

export function normalizeSolana(raw: RawToken, source: string): Token | null {
  const address = raw.address ?? raw.mint;
  const decimals = raw.decimals;

  if (!address || !raw.name || !raw.symbol || decimals == null) return null;

  return {
    chainId: SOLANA_CHAIN_ID,
    address,
    name: String(raw.name).trim(),
    symbol: String(raw.symbol).trim(),
    decimals: Number(decimals),
    logoURI: raw.logoURI ?? raw.logoUrl ?? raw.logo ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    extensions: { sources: [source], ...(raw.extensions ?? {}) },
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function deduplicateKey(token: Token): string {
  const addr = EVM_CHAIN_IDS.has(token.chainId)
    ? token.address.toLowerCase()
    : token.address;
  return `${token.chainId}:${addr}`;
}

export function deduplicate(tokens: Token[]): Token[] {
  const map = new Map<string, Token>();

  for (const token of tokens) {
    const key = deduplicateKey(token);

    if (!map.has(key)) {
      map.set(key, {
        ...token,
        extensions: { ...token.extensions, sources: [...token.extensions.sources] },
      });
    } else {
      const existing = map.get(key)!;
      const merged = new Set([...existing.extensions.sources, ...token.extensions.sources]);
      existing.extensions = { ...existing.extensions, ...token.extensions, sources: [...merged] };
      if (!existing.logoURI && token.logoURI) existing.logoURI = token.logoURI;
      if (!existing.tags.length && token.tags.length) existing.tags = token.tags;
    }
  }

  return [...map.values()];
}

// ─── Token list builder ───────────────────────────────────────────────────────

export function buildTokenList(name: string, tokens: Token[]): TokenList {
  return {
    name,
    timestamp: new Date().toISOString(),
    version: { major: 1, minor: 0, patch: 0 },
    tokens: [...tokens].sort((a, b) => {
      if (a.chainId !== b.chainId) return a.chainId - b.chainId;
      return a.symbol.localeCompare(b.symbol);
    }),
  };
}
