/**
 * Network constants shared by the deploy scripts.
 *
 * Arc Testnet is the only supported network (see engineer-prompts/00-arc-spec.md).
 */

export const ARC_TESTNET_CHAIN_ID = 5042002;
/** Arc mainnet (live per docs.arc.io; ChainPe does not target it yet). */
export const ARC_MAINNET_CHAIN_ID = 5042;

export const ARC_TESTNET_EXPLORER = "https://explorer.testnet.arc.io";

/** Arc's canonical ERC-8004 registries on Arc Testnet (docs.arc.io, v2.0.0). */
export const ARC_TESTNET_ERC8004 = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
} as const;

/** Canonical ERC-8004 IdentityRegistry per chain id, used as the deploy default. */
export const DEFAULT_IDENTITY_REGISTRY: Record<number, string> = {
  [ARC_TESTNET_CHAIN_ID]: ARC_TESTNET_ERC8004.identityRegistry,
};

export function explorerTx(chainId: number, hash: string): string | undefined {
  return chainId === ARC_TESTNET_CHAIN_ID ? `${ARC_TESTNET_EXPLORER}/tx/${hash}` : undefined;
}

export function explorerAddress(chainId: number, address: string): string | undefined {
  return chainId === ARC_TESTNET_CHAIN_ID ? `${ARC_TESTNET_EXPLORER}/address/${address}` : undefined;
}

/** USDC ERC-20 interface (6 decimals) per chain id. */
export const DEFAULT_USDC: Record<number, string> = {
  [ARC_TESTNET_CHAIN_ID]: "0x3600000000000000000000000000000000000000",
};

/**
 * Chain ids treated as production: deploy scripts refuse a deployer-EOA owner
 * there unless ALLOW_DEPLOYER_OWNER=true.
 */
export const PRODUCTION_CHAIN_IDS = new Set<number>([ARC_MAINNET_CHAIN_ID]);

/**
 * Native balances on Arc are USDC with 18 decimals (the gas token). Format with
 * ethers.formatEther and label with this symbol.
 */
export const NATIVE_SYMBOL = "USDC";

/**
 * File slug for deployments/<slug>.json. The Hardhat network `arcTestnet` maps
 * to ChainPe's network name `arc-testnet`; other networks keep their name.
 */
export function deploymentSlug(networkName: string): string {
  return networkName === "arcTestnet" ? "arc-testnet" : networkName;
}
