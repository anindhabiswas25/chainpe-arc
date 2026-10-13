/**
 * Deploy private copies of the ERC-8004 (Trustless Agents) registries.
 *
 * On Arc Testnet ChainPe uses Arc's canonical registries instead
 * (scripts/record-erc8004.ts). This script refuses to deploy there unless
 * DEPLOY_OWN_ERC8004=true, since a private copy would split agent reputation
 * away from the rest of the Arc ecosystem.
 *
 * Usage:
 *   DEPLOY_OWN_ERC8004=true npx hardhat run scripts/deploy-erc8004.ts --network arcTestnet
 *
 * Writes addresses to deployments/<network>-erc8004.json. Pass the resulting
 * identityRegistry into the ChainPeRegistry deploy (IDENTITY_REGISTRY env) so
 * service listings can link to ERC-8004 agent identities.
 */
import { ARC_TESTNET_CHAIN_ID, deploymentSlug } from "./lib/networks";
import { ethers, network } from "hardhat";
import { deployErc8004 } from "./lib/deployErc8004";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) === ARC_TESTNET_CHAIN_ID && process.env.DEPLOY_OWN_ERC8004 !== "true") {
    throw new Error(
      "Arc Testnet already has canonical ERC-8004 registries. Record them with\n" +
        "  npx hardhat run scripts/record-erc8004.ts --network arcTestnet\n" +
        "or set DEPLOY_OWN_ERC8004=true to deploy private copies anyway."
    );
  }
  console.log(`\nDeploying ERC-8004 registries to ${network.name} (chainId ${net.chainId})`);
  console.log(`  Deployer: ${deployer.address}\n`);

  const addrs = await deployErc8004();

  console.log("========================================");
  console.log("  ERC-8004 registries deployed");
  console.log("========================================");
  console.log(`  IdentityRegistry:   ${addrs.identityRegistry}`);
  console.log(`  ReputationRegistry: ${addrs.reputationRegistry}`);
  console.log(`  ValidationRegistry: ${addrs.validationRegistry}`);

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = {
    network: network.name,
    chainId: Number(net.chainId),
    ...addrs,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    note: "ERC-8004 reference contracts behind ERC-1967 proxies (UUPS).",
  };
  writeFileSync(join(dir, `${deploymentSlug(network.name)}-erc8004.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(`\n  Saved -> deployments/${deploymentSlug(network.name)}-erc8004.json`);
  console.log(`  Set IDENTITY_REGISTRY=${addrs.identityRegistry} when deploying ChainPeRegistry.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
