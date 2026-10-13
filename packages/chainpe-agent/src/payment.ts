/**
 * Payment Client (Arc Testnet)
 *
 * Handles the x402 v2 payment flow with `@x402/fetch`: `fetch` is wrapped so a
 * 402 on Arc Testnet (`eip155:5042002`) is paid automatically in USDC via
 * EIP-3009 and the request retried.
 */

import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { formatUnits } from "viem";

import type {
  PaymentReceipt,
  PaymentToken,
  HttpRequestOptions,
  HttpResponse,
  ServiceInfo,
  ChainPeNetwork,
} from "./types.js";
import { X402_NETWORK, USDC_DECIMALS } from "./types.js";
import { addressFromPrivateKey, createWalletFromPrivateKey, parseAmount } from "./wallet.js";

export interface PaymentClientOptions {
  privateKey: string;
  network?: ChainPeNetwork;
  onPayment?: (receipt: PaymentReceipt) => void;
  /** Max USDC per payment (human string). Defaults to "10". */
  maxPerPayment?: string;
}

export class PaymentClient {
  private readonly privateKey: string;
  private readonly network: ChainPeNetwork;
  private readonly onPayment?: (receipt: PaymentReceipt) => void;
  private readonly maxValueAtomic: bigint;
  private readonly address: string;

  private wrappedFetch?: typeof fetch;
  /** Offer signed for the in-flight request (amount + payTo for the receipt). */
  private lastAccepted?: PaymentRequirements;
  private receipts: PaymentReceipt[] = [];
  private totalSpent: Record<PaymentToken, bigint> = { USDC: 0n };

  constructor(options: PaymentClientOptions) {
    this.privateKey = options.privateKey;
    this.network = options.network || "arc-testnet";
    this.onPayment = options.onPayment;
    this.maxValueAtomic = parseAmount(options.maxPerPayment ?? "10");
    this.address = addressFromPrivateKey(options.privateKey);
  }

  /** Lazily builds the x402-wrapped fetch. */
  private async ensureReady(): Promise<typeof fetch> {
    if (!this.wrappedFetch) {
      const wallet = await createWalletFromPrivateKey(this.privateKey, this.network);
      const client = new x402Client()
        .register(X402_NETWORK[this.network], new ExactEvmScheme(wallet.signer))
        .setSpendControls({
          maxAmountPerPayment: `$${formatUnits(this.maxValueAtomic, USDC_DECIMALS)}`,
        })
        .onAfterPaymentCreation(async ({ paymentPayload }) => {
          this.lastAccepted = paymentPayload.accepted;
        });
      this.wrappedFetch = wrapFetchWithPayment(fetch, client);
    }
    return this.wrappedFetch;
  }

  getAddress(): string {
    return this.address;
  }

  /** Makes an HTTP request with automatic x402 payment handling. */
  async fetch<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const { method = "GET", headers = {}, body, timeout = 30000 } = options;
    const wrapped = await this.ensureReady();

    const fetchOptions: RequestInit = {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      signal: AbortSignal.timeout(timeout),
    };
    if (body && method !== "GET") fetchOptions.body = JSON.stringify(body);

    this.lastAccepted = undefined;
    const response = await wrapped(url, fetchOptions);

    // The provider sets PAYMENT-RESPONSE when a payment was made & settled.
    const settleHeader = response.headers.get("PAYMENT-RESPONSE");
    const paid = !!settleHeader;
    let receipt: PaymentReceipt | undefined;
    if (paid) {
      receipt = this.recordPayment(url, settleHeader);
    }

    const data = await this.parseResponse<T>(response);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: this.headersToObject(response.headers),
      data,
      paid,
      paymentReceipt: receipt,
    };
  }

  /** Makes a request to a known paid service. */
  async callService<T = unknown>(
    service: ServiceInfo,
    path: string = "/",
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const url = new URL(path, service.endpoint).toString();
    const response = await this.fetch<T>(url, options);
    // Enrich the receipt with the service's metadata when available.
    if (response.paymentReceipt) {
      response.paymentReceipt.service = service.name;
      response.paymentReceipt.recipient = service.walletAddress || response.paymentReceipt.recipient;
      if (!response.paymentReceipt.amount || response.paymentReceipt.amount === "0") {
        response.paymentReceipt.amount = service.pricePerRequest;
      }
    }
    return response;
  }

  private recordPayment(url: string, settleHeader: string): PaymentReceipt {
    const accepted = this.lastAccepted;
    let txId: string | undefined;
    try {
      txId = decodePaymentResponseHeader(settleHeader).transaction || undefined;
    } catch {
      /* header not decodable, keep defaults */
    }

    const receipt: PaymentReceipt = {
      txId,
      amount: accepted ? formatUnits(BigInt(accepted.amount), USDC_DECIMALS) : "0",
      token: "USDC",
      recipient: accepted?.payTo ?? "unknown",
      timestamp: new Date(),
      service: "Unknown Service",
      path: safePath(url),
    };

    this.receipts.push(receipt);
    return receipt;
  }

  getReceipts(): PaymentReceipt[] {
    return [...this.receipts];
  }

  getTotalSpent(): Record<PaymentToken, string> {
    // Sum from receipt amounts (human strings) for an accurate total.
    let sum = 0n;
    for (const r of this.receipts) {
      try {
        sum += parseAmount(r.amount || "0");
      } catch {
        /* ignore */
      }
    }
    this.totalSpent.USDC = sum;
    return { USDC: formatAtomic(sum) };
  }

  getTransactionCount(): number {
    return this.receipts.length;
  }

  reset(): void {
    this.receipts = [];
    this.totalSpent = { USDC: 0n };
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  private headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}

function formatAtomic(atomic: bigint): string {
  const divisor = 1_000_000n;
  const whole = atomic / divisor;
  const frac = atomic % divisor;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Creates a payment client. */
export function createPaymentClient(
  privateKey: string,
  options: Partial<PaymentClientOptions> = {}
): PaymentClient {
  return new PaymentClient({ privateKey, ...options });
}
