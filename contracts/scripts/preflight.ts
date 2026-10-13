/**
 * Deploy preflight: prints the signer Hardhat will actually use, its balance,
 * the live gas price, and an estimated total deploy cost. Read-only — sends no tx.
 */
import { ethers, network } from "hardhat";
import { NATIVE_SYMBOL } from "./lib/networks";

// Address the funded deployer key is expected to derive to (set EXPECTED_DEPLOYER).
const EXPECTED = process.env.EXPECTED_DEPLOYER ?? "";
// ERC-1967 proxy deploy + initialize, upper bound (measured ~0.4–0.6M locally).
const PROXY_GAS_EST = 1_000_000n;

async function main() {
  const [signer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const addr = await signer.getAddress();
  const bal = await ethers.provider.getBalance(addr);
  const fee = await ethers.provider.getFeeData();
  // EIP-1559 worst case: maxFeePerGas (Arc's base fee floor is 20 gwei).
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;

  // Estimate the real deploy cost: two implementations + two proxies
  // (ERC-8004 uses Arc's canonical registries, so nothing to deploy there).
  let totalGas = 0n;
  for (const name of ["ChainPeRegistryUpgradeable", "PolicyVaultUpgradeable"]) {
    const f = await ethers.getContractFactory(name);
    const g = await ethers.provider.estimateGas({ ...(await f.getDeployTransaction()), from: addr });
    console.log(`  Est. gas ${name}: ${g}`);
    totalGas += g + PROXY_GAS_EST;
  }

  console.log(`\n  Network:        ${network.name} (chainId ${net.chainId})`);
  console.log(`  Signer (env):   ${addr}`);
  console.log(`  Expected:       ${EXPECTED}`);
  console.log(`  MATCH:          ${addr.toLowerCase() === EXPECTED.toLowerCase() ? "YES ✓" : "NO ✗ — env key is a DIFFERENT wallet!"}`);
  console.log(`  Balance:        ${ethers.formatEther(bal)} ${NATIVE_SYMBOL}`);
  console.log(`  Max fee/gas:    ${ethers.formatUnits(gasPrice, 9)} gwei`);
  const estCost = totalGas * gasPrice;
  console.log(`  Est. full deploy (~${totalGas} gas @ ${ethers.formatUnits(gasPrice, 9)} gwei max): ${ethers.formatEther(estCost)} ${NATIVE_SYMBOL}`);
  console.log(`  Sufficient:     ${bal > estCost ? "YES ✓" : "NO ✗"}\n`);

  if (EXPECTED && addr.toLowerCase() !== EXPECTED.toLowerCase()) {
    throw new Error("Signer mismatch — refusing. Set DEPLOYER_PRIVATE_KEY to the funded key.");
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; });
