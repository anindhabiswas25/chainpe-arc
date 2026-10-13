/**
 * Verify the ERC-1967 proxies and the timelock through Blockscout's native v2
 * API (standard JSON input).
 *
 * Use this when `npm run verify` (hardhat-verify, etherscan-style API) is stuck
 * on HTTP 429: the v2 API has a separate rate limit. It reads the compiler
 * input from artifacts/build-info, so run `npx hardhat compile` first.
 *
 * Usage:
 *   npm run verify:blockscout
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { AbiCoder } from "ethers";

const EXPLORER = "https://explorer.testnet.arc.io";
const DEPLOYMENTS = join(__dirname, "..", "deployments");
const BUILD_INFO = join(__dirname, "..", "artifacts", "build-info");
const PROXY = "contracts/erc8004/ERC1967Proxy.sol:ERC1967Proxy";
const TIMELOCK = "contracts/governance/ChainPeTimelock.sol:ChainPeTimelock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const load = (file: string) => JSON.parse(readFileSync(join(DEPLOYMENTS, file), "utf-8"));

/** The build-info that compiled `fqn` ("path.sol:Name"). */
function buildInfoFor(fqn: string) {
  const [source, name] = fqn.split(":");
  if (!existsSync(BUILD_INFO)) throw new Error("No artifacts/build-info. Run `npx hardhat compile` first.");
  for (const file of readdirSync(BUILD_INFO)) {
    const info = JSON.parse(readFileSync(join(BUILD_INFO, file), "utf-8"));
    if (info.output?.contracts?.[source]?.[name]) return info;
  }
  throw new Error(`${fqn} not found in artifacts/build-info.`);
}

async function status(address: string): Promise<boolean> {
  const res = await fetch(`${EXPLORER}/api/v2/smart-contracts/${address}`);
  if (!res.ok) return false;
  return (await res.json()).is_verified === true;
}

async function verify(label: string, address: string, fqn: string, constructorArgs: string) {
  if (await status(address)) {
    console.log(`  ${label} ${address}: already verified ✓`);
    return;
  }
  const info = buildInfoFor(fqn);
  const form = new FormData();
  form.append("compiler_version", `v${info.solcLongVersion}`);
  form.append("contract_name", fqn);
  form.append("license_type", "mit");
  form.append("autodetect_constructor_args", "false");
  form.append("constructor_args", constructorArgs.replace(/^0x/, ""));
  form.append("files[0]", new Blob([JSON.stringify(info.input)], { type: "application/json" }), "input.json");

  const res = await fetch(`${EXPLORER}/api/v2/smart-contracts/${address}/verification/via/standard-input`, {
    method: "POST",
    body: form,
  });
  console.log(`  ${label} ${address}: submitted (HTTP ${res.status}) ${(await res.text()).slice(0, 160)}`);
  if (!res.ok) {
    process.exitCode = 1;
    return;
  }
  // Verification runs asynchronously on the explorer.
  for (let i = 0; i < 12; i++) {
    await sleep(10_000);
    if (await status(address)) {
      console.log(`  ${label}: verified ✓  ${EXPLORER}/address/${address}#code`);
      return;
    }
  }
  console.error(`  ✗ ${label}: still unverified after 2 minutes`);
  process.exitCode = 1;
}

async function main() {
  const coder = AbiCoder.defaultAbiCoder();
  const reg = load("arc-testnet.json");
  const vault = load("arc-testnet-policyvault.json");
  const tl = load("arc-testnet-timelock.json");

  await verify(
    "ChainPeRegistry (proxy)",
    reg.chainPeRegistryProxy,
    PROXY,
    coder.encode(["address", "bytes"], [reg.chainPeRegistryImpl, reg.initData])
  );
  await verify(
    "PolicyVault (proxy)",
    vault.policyVaultProxy,
    PROXY,
    coder.encode(["address", "bytes"], [vault.policyVaultImpl, vault.initData])
  );
  await verify(
    "ChainPeTimelock",
    tl.timelock,
    TIMELOCK,
    coder.encode(["uint256", "address[]", "address[]", "address"], [tl.minDelay, tl.proposers, tl.executors, tl.admin])
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
