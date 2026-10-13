/**
 * Post-deploy sanity check: reads live state from the deployed proxies.
 *
 * Addresses default to deployments/<slug>.json, <slug>-policyvault.json and
 * <slug>-erc8004.json; env vars REGISTRY_ADDRESS, POLICY_VAULT_ADDRESS and
 * IDENTITY_REGISTRY override them.
 */
import { ethers, network } from "hardhat";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ARC_TESTNET_CHAIN_ID, DEFAULT_IDENTITY_REGISTRY, DEFAULT_USDC, NATIVE_SYMBOL, deploymentSlug } from "./lib/networks";

function load(file: string): Record<string, any> {
  const path = join(__dirname, "..", "deployments", file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
}

function requireAddress(name: string, value: string | undefined): string {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} is not configured (no deployment record and no env override).`);
  }
  return ethers.getAddress(value);
}

let failures = 0;
function check(label: string, ok: boolean, value: unknown) {
  console.log(`  ${label.padEnd(18)} ${value} ${ok ? "✓" : "✗"}`);
  if (!ok) failures++;
}

async function main() {
  const slug = deploymentSlug(network.name);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const reg = load(`${slug}.json`);
  const vaultRec = load(`${slug}-policyvault.json`);
  const erc8004 = load(`${slug}-erc8004.json`);

  const REGISTRY = requireAddress("REGISTRY_ADDRESS", process.env.REGISTRY_ADDRESS || reg.chainPeRegistryProxy);
  const VAULT = requireAddress("POLICY_VAULT_ADDRESS", process.env.POLICY_VAULT_ADDRESS || vaultRec.policyVaultProxy);
  const IDENTITY = requireAddress(
    "IDENTITY_REGISTRY",
    process.env.IDENTITY_REGISTRY || erc8004.identityRegistryAddress || DEFAULT_IDENTITY_REGISTRY[chainId]
  );
  const USDC = ethers.getAddress(process.env.USDC_ADDRESS || DEFAULT_USDC[chainId] || DEFAULT_USDC[ARC_TESTNET_CHAIN_ID]);

  const [signer] = await ethers.getSigners();
  const r = await ethers.getContractAt("ChainPeRegistryUpgradeable", REGISTRY);
  const v = await ethers.getContractAt("PolicyVaultUpgradeable", VAULT);

  console.log(`\n  ── ChainPeRegistry ${REGISTRY} ──`);
  const regOwner = await r.owner();
  check("owner", !reg.owner || regOwner === ethers.getAddress(reg.owner), regOwner);
  const feeToken = await r.feeToken();
  check("feeToken", feeToken === USDC, `${feeToken} (USDC)`);
  check("registrationFee", true, `${await r.registrationFee()} (6-dp USDC)`);
  const idReg = await r.identityRegistry();
  check("identityRegistry", idReg === IDENTITY, idReg);
  check("serviceCount", true, (await r.getServiceCount()).toString());

  console.log(`\n  ── PolicyVault ${VAULT} ──`);
  const vaultOwner = await v.owner();
  check("owner", !vaultRec.owner || vaultOwner === ethers.getAddress(vaultRec.owner), vaultOwner);
  const token = await v.token();
  check("token", token === USDC, `${token} (USDC)`);
  check("paused", (await v.paused()) === false, await v.paused());

  const bal = await ethers.provider.getBalance(signer.address);
  console.log(`\n  Signer ${signer.address} balance: ${ethers.formatEther(bal)} ${NATIVE_SYMBOL}`);
  if (failures) throw new Error(`${failures} check(s) failed`);
  console.log("  All checks passed.\n");
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; });
