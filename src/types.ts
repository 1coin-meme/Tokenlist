export interface TokenListVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface TokenExtensions {
  sources: string[];
  [key: string]: unknown;
}

export interface Token {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  extensions: TokenExtensions;
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: TokenListVersion;
  tokens: Token[];
}

export type ChainSlug = 'ethereum' | 'bsc' | 'base' | 'solana';

export interface ChainConfig {
  chainId: number;
  label: string;
}

export const CHAINS: Record<ChainSlug, ChainConfig> = {
  ethereum: { chainId: 1,    label: 'Ethereum' },
  bsc:      { chainId: 56,   label: 'BNB Smart Chain' },
  base:     { chainId: 8453, label: 'Base' },
  solana:   { chainId: 101,  label: 'Solana' },
};

export const EVM_CHAIN_IDS = new Set([1, 56, 8453]);
export const SOLANA_CHAIN_ID = 101;

/** Passed to every source so it can read project-level config. */
export interface SourceContext {
  /** Absolute path to the project root (where config/ lives). */
  root: string;
}

/** A pluggable token data source. */
export interface TokenSource {
  /** Unique identifier used in token `extensions.sources`. */
  id: string;
  /** Human-readable description shown in logs. */
  description?: string;
  fetch(ctx: SourceContext): Promise<Token[]>;
}
