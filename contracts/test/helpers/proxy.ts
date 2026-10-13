/**
 * Deploys the UUPS implementations behind an ERC-1967 proxy, the same way the
 * deploy scripts do, so behavioural tests exercise the deployed topology.
 */
import { ethers } from "hardhat";
import type { ChainPeRegistryUpgradeable, PolicyVaultUpgradeable } from "../../typechain-types";

const PROXY = "contracts/erc8004/ERC1967Proxy.sol:ERC1967Proxy";

async function deployBehindProxy(implName: string, initArgs: unknown[]) {
  const Impl = await ethers.getContractFactory(implName);
  const impl = await Impl.deploy();
  await impl.waitForDeployment();
  const Proxy = await ethers.getContractFactory(PROXY);
  // An initializer revert bubbles out of the proxy constructor.
  const proxy = await Proxy.deploy(
    await impl.getAddress(),
    Impl.interface.encodeFunctionData("initialize", initArgs)
  );
  await proxy.waitForDeployment();
  return ethers.getContractAt(implName, await proxy.getAddress());
}

export async function deployRegistry(
  feeToken: string,
  feeRecipient: string,
  registrationFee: bigint | number,
  identityRegistry: string,
  owner: string
): Promise<ChainPeRegistryUpgradeable> {
  return (await deployBehindProxy("ChainPeRegistryUpgradeable", [
    feeToken,
    feeRecipient,
    registrationFee,
    identityRegistry,
    owner,
  ])) as unknown as ChainPeRegistryUpgradeable;
}

export async function deployVault(token: string, owner: string): Promise<PolicyVaultUpgradeable> {
  return (await deployBehindProxy("PolicyVaultUpgradeable", [token, owner])) as unknown as PolicyVaultUpgradeable;
}
