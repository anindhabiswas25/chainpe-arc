/**
 * In-memory stand-in for Arc USDC (FiatTokenV2_2 EIP-3009 surface) behind the
 * FacilitatorEvmSigner interface. Signatures are recovered for real; balances
 * and used nonces are tracked so verify/settle behave like the chain.
 */
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  erc20Abi,
  getAddress,
  keccak256,
  recoverTypedDataAddress,
  serializeSignature,
  toHex,
  verifyTypedData,
  type Hex,
} from "viem";
import { eip3009ABI, type FacilitatorEvmSigner } from "@x402/evm";
import { ARC_USDC_ADDRESS, ARC_USDC_EIP712_DOMAIN } from "../../../packages/chainpe-sdk/src/arc.js";

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export class FakeArcUsdc {
  balances = new Map<string, bigint>();
  usedNonces = new Set<string>();
  sent: Hex[] = [];
  private receipts = new Map<Hex, { status: string; logs: { address: Hex; topics: Hex[]; data: Hex }[] }>();

  constructor(readonly facilitatorAddress: `0x${string}`) {}

  fund(addr: string, atomic: bigint) {
    this.balances.set(getAddress(addr), atomic);
  }

  balanceOf(addr: string): bigint {
    return this.balances.get(getAddress(addr)) ?? 0n;
  }

  /** Mirrors FiatTokenV2 transferWithAuthorization; throws its revert strings. */
  private async checkTransfer(args: readonly unknown[]) {
    const [from, to, value, validAfter, validBefore, nonce, ...sig] = args as [
      Hex, Hex, bigint, bigint, bigint, Hex, ...unknown[],
    ];
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now <= validAfter) throw new Error("FiatTokenV2: authorization is not yet valid");
    if (now >= validBefore) throw new Error("FiatTokenV2: authorization is expired");
    if (this.usedNonces.has(`${getAddress(from)}:${nonce}`)) {
      throw new Error("FiatTokenV2: authorization is used or canceled");
    }
    const signature =
      sig.length === 3
        ? serializeSignature({ v: BigInt(sig[0] as number), r: sig[1] as Hex, s: sig[2] as Hex })
        : (sig[0] as Hex);
    const signer = await recoverTypedDataAddress({
      domain: ARC_USDC_EIP712_DOMAIN,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message: { from, to, value, validAfter, validBefore, nonce },
      signature,
    });
    if (getAddress(signer) !== getAddress(from)) throw new Error("FiatTokenV2: invalid signature");
    if (this.balanceOf(from) < value) throw new Error("ERC20: transfer amount exceeds balance");
    return { from: getAddress(from), to: getAddress(to), value, nonce };
  }

  private async call(functionName: string, args: readonly unknown[] = []): Promise<unknown> {
    switch (functionName) {
      case "balanceOf":
        return this.balanceOf(args[0] as string);
      case "name":
        return ARC_USDC_EIP712_DOMAIN.name;
      case "version":
        return ARC_USDC_EIP712_DOMAIN.version;
      case "decimals":
        return 6;
      case "authorizationState":
        return this.usedNonces.has(`${getAddress(args[0] as string)}:${args[1]}`);
      case "transferWithAuthorization":
        await this.checkTransfer(args);
        return undefined;
      default:
        throw new Error(`fake USDC: unsupported call ${functionName}`);
    }
  }

  signer(): FacilitatorEvmSigner {
    return {
      getAddresses: () => [this.facilitatorAddress],
      readContract: async ({ address, functionName, args }) => {
        if (getAddress(address) === MULTICALL3 && functionName === "tryAggregate") {
          const calls = (args?.[1] ?? []) as { target: Hex; callData: Hex }[];
          return Promise.all(
            calls.map(async ({ target, callData }) => {
              try {
                if (getAddress(target) !== getAddress(ARC_USDC_ADDRESS)) throw new Error("no code");
                const abi = [...eip3009ABI, ...erc20Abi];
                const decoded = decodeFunctionData({ abi, data: callData });
                const result = await this.call(decoded.functionName, decoded.args ?? []);
                const returnData =
                  result === undefined
                    ? "0x"
                    : encodeFunctionResult({ abi, functionName: decoded.functionName, result } as never);
                return { success: true, returnData };
              } catch {
                return { success: false, returnData: "0x" };
              }
            })
          );
        }
        if (getAddress(address) !== getAddress(ARC_USDC_ADDRESS)) throw new Error("execution reverted");
        return this.call(functionName, args);
      },
      verifyTypedData: (args) => verifyTypedData(args as never),
      writeContract: async ({ address, functionName, args }) => {
        if (getAddress(address) !== getAddress(ARC_USDC_ADDRESS) || functionName !== "transferWithAuthorization") {
          throw new Error(`fake chain: unexpected write ${functionName}`);
        }
        const t = await this.checkTransfer(args);
        this.usedNonces.add(`${t.from}:${t.nonce}`);
        this.balances.set(t.from, this.balanceOf(t.from) - t.value);
        this.balances.set(t.to, this.balanceOf(t.to) + t.value);
        const hash = keccak256(toHex(`tx-${this.sent.length}-${t.nonce}`));
        this.sent.push(hash);
        this.receipts.set(hash, {
          status: "success",
          logs: [
            {
              address: ARC_USDC_ADDRESS,
              topics: encodeEventTopics({
                abi: erc20Abi,
                eventName: "Transfer",
                args: { from: t.from, to: t.to },
              }) as Hex[],
              data: encodeAbiParameters([{ type: "uint256" }], [t.value]),
            },
          ],
        });
        return hash;
      },
      sendTransaction: async () => {
        throw new Error("fake chain: sendTransaction not supported");
      },
      waitForTransactionReceipt: async ({ hash }) => {
        const r = this.receipts.get(hash);
        if (!r) throw new Error("receipt not found");
        return r as never;
      },
      getCode: async ({ address }) =>
        getAddress(address) === getAddress(ARC_USDC_ADDRESS) ? "0x6080604052" : "0x",
    };
  }
}
