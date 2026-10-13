/**
 * In-process x402 facilitator (optional).
 *
 * Instead of calling an external facilitator over HTTP, the provider can verify
 * and settle in-process with a funded gas key. It uses the same upstream
 * `@x402/evm` exact scheme as services/chainpe-facilitator (EIP-712 signature,
 * payTo, validity window, exact amount, on-chain simulation).
 *
 * Settlement submits the payer's signed EIP-3009 `transferWithAuthorization`
 * and pays the gas (USDC, native on Arc). The key only pays gas and relays the
 * payer's signature. It never receives the payment, which goes to `payTo`.
 */
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Facilitator } from "@x402/core/facilitator";
import type { FacilitatorClient } from "@x402/core/server";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { getNetwork, type ChainPeNetwork } from "../chains.js";
import { logger } from "../logger.js";

function normalizeKey(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

export function createLocalFacilitator(privateKey: string, network: ChainPeNetwork): FacilitatorClient {
  const info = getNetwork(network);
  const account = privateKeyToAccount(normalizeKey(privateKey));
  const client = createWalletClient({ account, chain: info.chain, transport: http(info.rpcUrl) }).extend(
    publicActions
  );

  const signer = toFacilitatorEvmSigner({
    address: account.address,
    readContract: (args) => client.readContract(args as never),
    verifyTypedData: (args) => client.verifyTypedData(args as never),
    writeContract: (args) => client.writeContract(args as never),
    sendTransaction: (args) => client.sendTransaction(args),
    waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
    getCode: (args) => client.getCode(args),
  });

  const facilitator = new x402Facilitator().register(
    info.x402Network,
    new ExactEvmScheme(signer, { simulateInSettle: true })
  );

  logger.info(`Local facilitator wallet: ${account.address} (pays USDC gas on ${network})`);

  return {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    getSupported: async () => facilitator.getSupported() as Awaited<ReturnType<FacilitatorClient["getSupported"]>>,
  };
}
