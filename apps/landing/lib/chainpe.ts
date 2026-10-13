// ChainPe on Arc Testnet: the facts the landing page shows. Addresses mirror
// docs/DEPLOYMENTS.md and contracts/deployments/arc-testnet*.json.

export const ARC_CHAIN_ID = 5042002;
export const EXPLORER_URL = "https://explorer.testnet.arc.io";
export const FAUCET_URL = "https://faucet.circle.com";
/**
 * Public ChainPe repository. There is no confirmed URL yet, so GitHub links
 * render only when this is set at build time.
 */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL?.replace(/\/$/, "") || null;
/** What `git clone` examples show: the repository when known, else a placeholder. */
export const CLONE_URL = GITHUB_URL ?? "<ChainPe repo URL>";
export const QUICKSTART_PATH = "/docs/getting-started/quickstart";

/**
 * Where the dashboard (apps/dashboard) is hosted. There is no confirmed public
 * URL yet, so dashboard links render only when this is set at build time.
 */
export const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "") || null;

export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;

export interface LiveContract {
  name: string;
  address: string;
  role: string;
  /** What the Arc explorer shows for the source (checked 2026-10-13). */
  source: string;
}

/** Deployed by ChainPe on 2026-10-13. */
export const CHAINPE_CONTRACTS: LiveContract[] = [
  {
    name: "ChainPeRegistry",
    address: "0x79c7a22993A40A3c88355b737e6F608c6610c395",
    role: "Service catalogue. Listing costs a USDC fee.",
    source: "UUPS proxy, implementation source-verified",
  },
  {
    name: "PolicyVault",
    address: "0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81",
    role: "Agent budgets with per-call, daily and total caps.",
    source: "UUPS proxy, implementation source-verified",
  },
  {
    name: "ChainPeTimelock",
    address: "0x5071794F30C32604Be115c00Ed041c403fB2f302",
    role: "48-hour governance timelock. Not yet the owner of anything.",
    source: "Source not verified on the explorer yet",
  },
];

/** Arc's canonical ERC-8004 registries (v2.0.0). ChainPe uses them; it did not deploy them. */
export const ERC8004_CONTRACTS: LiveContract[] = [
  {
    name: "ERC-8004 IdentityRegistry",
    address: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    role: "Agent identities (ERC-721).",
    source: "Arc canonical deployment",
  },
  {
    name: "ERC-8004 ReputationRegistry",
    address: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    role: "On-chain feedback. Self-feedback reverts.",
    source: "Arc canonical deployment",
  },
  {
    name: "ERC-8004 ValidationRegistry",
    address: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    role: "Third-party validation of agent work.",
    source: "Arc canonical deployment",
  },
];
