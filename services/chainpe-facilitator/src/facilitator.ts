/**
 * x402 v2 facilitator core for Arc Testnet.
 *
 * Verification and settlement are delegated to `@x402/evm`'s `exact` scheme
 * (EIP-3009 `transferWithAuthorization`). It checks the EIP-712 signature
 * against the token's domain, payTo, validAfter/validBefore, the exact amount,
 * and simulates the transfer on-chain, which catches a used nonce
 * (`authorizationState`) and an insufficient payer balance.
 *
 * On top of that, ChainPe only relays Arc USDC: any other network or asset is
 * rejected before the scheme runs, so the gas key cannot be used to move
 * arbitrary EIP-3009 tokens.
 */
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { FacilitatorEvmSigner } from "@x402/evm";
import { getAddress, isAddress } from "viem";
import { ARC_USDC_ADDRESS, X402_NETWORK } from "../../../packages/chainpe-sdk/src/arc.js";

export const ERR_UNSUPPORTED_NETWORK = "unsupported_network";
export const ERR_UNSUPPORTED_ASSET = "unsupported_asset";

/** Returns a rejection reason when the requirements are not Arc USDC. */
export function checkArcUsdc(requirements: PaymentRequirements): string | undefined {
  if (requirements.network !== X402_NETWORK) return ERR_UNSUPPORTED_NETWORK;
  if (
    typeof requirements.asset !== "string" ||
    !isAddress(requirements.asset) ||
    getAddress(requirements.asset) !== getAddress(ARC_USDC_ADDRESS)
  ) {
    return ERR_UNSUPPORTED_ASSET;
  }
  return undefined;
}

export function createArcFacilitator(signer: FacilitatorEvmSigner): x402Facilitator {
  const facilitator = new x402Facilitator().register(
    X402_NETWORK,
    // Re-simulate on settle so a replayed nonce or drained payer fails before
    // the gas key pays for a reverting transaction.
    new ExactEvmScheme(signer, { simulateInSettle: true })
  );

  const guard = async (ctx: { paymentPayload: PaymentPayload; requirements: PaymentRequirements }) => {
    const reason =
      checkArcUsdc(ctx.requirements) ??
      (ctx.paymentPayload.accepted ? checkArcUsdc(ctx.paymentPayload.accepted) : undefined);
    return reason ? { abort: true as const, reason } : undefined;
  };
  facilitator.onBeforeVerify(guard);
  facilitator.onBeforeSettle(guard);
  return facilitator;
}
