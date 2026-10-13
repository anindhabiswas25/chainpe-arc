/**
 * Verify deployed ChainPe contracts on the Arc Testnet explorer (Blockscout,
 * etherscan-compatible API; see `etherscan.customChains` in hardhat.config.ts).
 *
 * Reads deployments/<slug>.json, <slug>-policyvault.json and (if present)
 * <slug>-timelock.json, then verifies each implementation (no constructor
 * args) and each ERC-1967 proxy (impl, initData).
 *
 * Usage:
 *   npm run verify
 *   VERIFY_ONLY=proxy,timelock VERIFY_SPACING_MS=60000 npm run verify   # when rate-limited
 */
import { run, network } from "hardhat";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { deploymentSlug } from "./lib/networks";

const PROXY = "contracts/erc8004/ERC1967Proxy.sol:ERC1967Proxy";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Blockscout rate-limits its API (HTTP 429), so space the requests out and retry.
const SPACING_MS = Number(process.env.VERIFY_SPACING_MS ?? 15_000);
const MAX_ATTEMPTS = Number(process.env.VERIFY_MAX_ATTEMPTS ?? 6);

// VERIFY_ONLY=proxy,timelock limits the run to labels containing one of the words.
const ONLY = (process.env.VERIFY_ONLY ?? "").toLowerCase().split(",").filter(Boolean);

/**
 * `force` submits even when the explorer claims "already verified". Blockscout's
 * etherscan-style API answers for an ERC-1967 proxy with its implementation's
 * source, so without it the proxy contract itself is never verified.
 */
async function verify(
  label: string,
  address: string,
  constructorArguments: unknown[] = [],
  contract?: string,
  force = false
) {
  if (ONLY.length && !ONLY.some((w) => label.toLowerCase().includes(w))) return;
  console.log(`\n  Verifying ${label} at ${address}…`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await run("verify:verify", { address, constructorArguments, force, ...(contract ? { contract } : {}) });
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already verified/i.test(msg)) {
        console.log("  already verified ✓");
        break;
      }
      const rateLimited = /429|too many requests|rate limit/i.test(msg);
      if (!rateLimited || attempt === MAX_ATTEMPTS) {
        console.error(`  ✗ ${label}: ${msg}`);
        process.exitCode = 1;
        break;
      }
      const backoff = SPACING_MS * attempt;
      console.log(`  rate-limited (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoff / 1000}s…`);
      await sleep(backoff);
    }
  }
  await sleep(SPACING_MS);
}

function load(file: string): Record<string, any> | undefined {
  const path = join(__dirname, "..", "deployments", file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : undefined;
}

async function main() {
  const slug = deploymentSlug(network.name);

  const reg = load(`${slug}.json`);
  if (reg) {
    await verify("ChainPeRegistryUpgradeable (impl)", reg.chainPeRegistryImpl, [], "contracts/ChainPeRegistryUpgradeable.sol:ChainPeRegistryUpgradeable");
    await verify("ChainPeRegistry (proxy)", reg.chainPeRegistryProxy, [reg.chainPeRegistryImpl, reg.initData], PROXY, true);
  }

  const vault = load(`${slug}-policyvault.json`);
  if (vault) {
    await verify("PolicyVaultUpgradeable (impl)", vault.policyVaultImpl, [], "contracts/PolicyVaultUpgradeable.sol:PolicyVaultUpgradeable");
    await verify("PolicyVault (proxy)", vault.policyVaultProxy, [vault.policyVaultImpl, vault.initData], PROXY, true);
  }

  const tl = load(`${slug}-timelock.json`);
  if (tl) {
    // Named explicitly: the bytecode also matches OpenZeppelin's TimelockController.
    await verify(
      "ChainPeTimelock",
      tl.timelock,
      [tl.minDelay, tl.proposers, tl.executors, tl.admin],
      "contracts/governance/ChainPeTimelock.sol:ChainPeTimelock"
    );
  }

  if (!reg && !vault && !tl) {
    throw new Error(`No deployment records found for ${slug} in deployments/.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
