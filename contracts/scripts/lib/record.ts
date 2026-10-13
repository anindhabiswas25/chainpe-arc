/**
 * Deployment record helpers: capture address, tx hash, block and explorer links
 * for each deployed contract so deployments/*.json is auditable.
 */
import type { BaseContract, ContractTransactionResponse } from "ethers";
import { explorerAddress, explorerTx } from "./networks";

export interface DeployedRecord {
  address: string;
  txHash: string;
  block: number;
  explorer?: string;
  txExplorer?: string;
}

/** Waits for a contract deployment and returns its on-chain record. */
export async function recordDeployment(contract: BaseContract, chainId: number): Promise<DeployedRecord> {
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  if (!tx) throw new Error(`No deployment transaction for ${address}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`No receipt for deployment tx ${tx.hash}`);
  return {
    address,
    txHash: tx.hash,
    block: receipt.blockNumber,
    explorer: explorerAddress(chainId, address),
    txExplorer: explorerTx(chainId, tx.hash),
  };
}

/** Waits for a state-changing tx and returns its hash/block record. */
export async function recordTx(
  tx: ContractTransactionResponse,
  chainId: number
): Promise<{ txHash: string; block: number; txExplorer?: string }> {
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`No receipt for tx ${tx.hash}`);
  return { txHash: tx.hash, block: receipt.blockNumber, txExplorer: explorerTx(chainId, tx.hash) };
}
