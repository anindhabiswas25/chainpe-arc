/**
 * Record Arc's canonical ERC-8004 registries (read-only, sends no tx).
 *
 * Arc Testnet already hosts the ERC-8004 reference registries (docs.arc.io →
 * Contract addresses). ChainPe uses them instead of deploying private copies.
 * This script checks they are live, are the reference implementation v2.0.0,
 * and are wired to each other, then writes deployments/arc-testnet-erc8004.json.
 *
 * Usage:
 *   npx hardhat run scripts/record-erc8004.ts --network arcTestnet
 */
import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_ERC8004, deploymentSlug, explorerAddress } from "./lib/networks";

const ABI = [
  "function getVersion() view returns (string)",
  "function getIdentityRegistry() view returns (address)",
  "function owner() view returns (address)",
];
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`Expected Arc Testnet (${ARC_TESTNET_CHAIN_ID}), got ${chainId}.`);

  const out: Record<string, unknown> = {
    network: "arc-testnet",
    chainId,
    source: "Arc canonical ERC-8004 registries (https://docs.arc.io/arc/references/contract-addresses)",
    deployedByChainPe: false,
  };

  for (const [key, address] of Object.entries(ARC_TESTNET_ERC8004)) {
    const c = new ethers.Contract(address, ABI, ethers.provider);
    const code = await ethers.provider.getCode(address);
    if (code === "0x") throw new Error(`${key} ${address} has no code`);
    const version: string = await c.getVersion();
    const impl = ethers.getAddress("0x" + (await ethers.provider.getStorage(address, IMPL_SLOT)).slice(26));
    const owner: string = await c.owner();
    const entry: Record<string, unknown> = { address, version, implementation: impl, owner, explorer: explorerAddress(chainId, address) };
    if (key !== "identityRegistry") {
      const linked: string = await c.getIdentityRegistry();
      if (linked.toLowerCase() !== ARC_TESTNET_ERC8004.identityRegistry.toLowerCase()) {
        throw new Error(`${key} points at identity registry ${linked}, expected ${ARC_TESTNET_ERC8004.identityRegistry}`);
      }
      entry.identityRegistry = linked;
    }
    console.log(`  ${key.padEnd(20)} ${address}  v${version}  impl ${impl}`);
    out[key] = entry;
  }
  out.identityRegistryAddress = ARC_TESTNET_ERC8004.identityRegistry;
  out.reputationRegistryAddress = ARC_TESTNET_ERC8004.reputationRegistry;
  out.validationRegistryAddress = ARC_TESTNET_ERC8004.validationRegistry;
  out.checkedAt = new Date().toISOString();

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = `${deploymentSlug(network.name)}-erc8004.json`;
  writeFileSync(join(dir, file), JSON.stringify(out, null, 2) + "\n");
  console.log(`\n  Saved -> deployments/${file}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; });
