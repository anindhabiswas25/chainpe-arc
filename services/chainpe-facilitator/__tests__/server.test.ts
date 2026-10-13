import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Server } from "node:http";
import pino from "pino";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createApp } from "../src/app.ts";
import { createArcFacilitator } from "../src/facilitator.ts";
import { FakeArcUsdc } from "./fakeChain.ts";
import { ARC_USDC_ADDRESS, X402_NETWORK } from "../../../packages/chainpe-sdk/src/arc.ts";

// Public Hardhat test keys (not real secrets).
const FACILITATOR = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const PAYER = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const PAY_TO = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Hardhat #2

let chain: FakeArcUsdc;
let server: Server;
let base: string;

const requirements = (over: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
  scheme: "exact",
  network: X402_NETWORK,
  asset: ARC_USDC_ADDRESS,
  amount: "10000", // 0.01 USDC
  payTo: PAY_TO,
  maxTimeoutSeconds: 120,
  extra: { name: "USDC", version: "2" },
  ...over,
});

/** Signs a real x402 v2 exact payment with the official client. */
async function sign(req: PaymentRequirements, account = PAYER): Promise<PaymentPayload> {
  const client = new x402Client()
    .register(X402_NETWORK, new ExactEvmScheme(account))
    // Let the test sign non-USDC assets so the facilitator guard can be exercised.
    .setSpendControls(false);
  return client.createPaymentPayload({
    x402Version: 2,
    resource: { url: "https://api.example.com/paid", description: "test", mimeType: "application/json" },
    accepts: [req],
  });
}

function withAuth(p: PaymentPayload, patch: Record<string, unknown>): PaymentPayload {
  const inner = p.payload as { authorization: Record<string, unknown>; signature: string };
  return { ...p, payload: { ...inner, authorization: { ...inner.authorization, ...patch } } };
}

async function post(path: string, paymentPayload: unknown, paymentRequirements: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  chain = new FakeArcUsdc(FACILITATOR.address);
  const app = createApp({
    facilitator: createArcFacilitator(chain.signer()),
    facilitatorAddress: FACILITATOR.address,
    getGasBalance: async () => 10n ** 18n,
    cachedGasBalance: () => 10n ** 18n,
    lowGasThreshold: 5n * 10n ** 17n,
    logger: pino({ level: "silent" }),
    rateLimitPerMinute: 1000,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  chain.fund(PAYER.address, 1_000_000n); // 1 USDC
});

describe("facilitator HTTP contract", () => {
  it("GET /health is a cheap liveness check", async () => {
    const body = await (await fetch(`${base}/health`)).json();
    expect(body.status).toBe("ok");
    expect(body.custodial).toBe(false);
    expect(body.x402Network).toBe("eip155:5042002");
    expect(body.facilitator.toLowerCase()).toBe(FACILITATOR.address.toLowerCase());
  });

  it("GET /supported advertises exact on eip155:5042002 (x402 v2)", async () => {
    const body = await (await fetch(`${base}/supported`)).json();
    expect(body.kinds).toEqual([{ x402Version: 2, scheme: "exact", network: "eip155:5042002" }]);
    expect(Object.values(body.signers).flat()).toContain(FACILITATOR.address);
  });

  it("GET / lists the endpoints and has a single network key", async () => {
    const res = await fetch(`${base}/`);
    const body = await res.json();
    expect(body.service).toBe("chainpe-facilitator");
    expect(body.endpoints).toContain("/settle");
    expect(body.network).toBe("arc-testnet");
    expect(body.x402Network).toBe("eip155:5042002");
  });

  it("POST /verify rejects a malformed payload with a 400", async () => {
    const { status, body } = await post("/verify", {}, {});
    expect(status).toBe(400);
    expect(body.isValid).toBe(false);
    expect(body.invalidReason).toBe("invalid_payload");
  });

  it("POST /settle rejects a malformed payload with a 400", async () => {
    const { status, body } = await post("/settle", { x402Version: 1 }, {});
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe("invalid_payload");
  });
});

describe("exact-scheme verification on Arc USDC", () => {
  it("accepts a valid authorization signed by the stock x402 client", async () => {
    const req = requirements();
    const { status, body } = await post("/verify", await sign(req), req);
    expect(status).toBe(200);
    expect(body).toMatchObject({ isValid: true, payer: PAYER.address });
  });

  it("rejects a bad signature", async () => {
    const req = requirements();
    const forged = await sign(req, privateKeyToAccount(generatePrivateKey()));
    // Claim the funded payer as `from`, signed by someone else.
    const { body } = await post("/verify", withAuth(forged, { from: PAYER.address }), req);
    expect(body).toMatchObject({ isValid: false, invalidReason: "invalid_exact_evm_signature" });
  });

  it("rejects an expired authorization", async () => {
    const req = requirements();
    const p = await sign(req);
    const { body } = await post("/verify", withAuth(p, { validBefore: "1" }), req);
    // The signature no longer matches the edited message, so recovery fails first.
    expect(body.isValid).toBe(false);

    // A genuinely signed but expired authorization is caught by the time check.
    const client = new x402Client().register(X402_NETWORK, new ExactEvmScheme(PAYER));
    const expired = await client.createPaymentPayload({
      x402Version: 2,
      resource: { url: "https://api.example.com/paid" },
      accepts: [requirements({ maxTimeoutSeconds: 1 })],
    });
    await new Promise((r) => setTimeout(r, 1100));
    const res = await post("/verify", expired, requirements({ maxTimeoutSeconds: 1 }));
    expect(res.body).toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
    });
  });

  it("rejects underpayment", async () => {
    const paid = await sign(requirements({ amount: "5000" }));
    const { body } = await post("/verify", { ...paid, accepted: requirements() }, requirements());
    expect(body).toMatchObject({
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_value_mismatch",
    });
  });

  it("rejects a wrong payTo", async () => {
    const elsewhere = requirements({ payTo: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" });
    const p = await sign(elsewhere);
    const { body } = await post("/verify", { ...p, accepted: requirements() }, requirements());
    expect(body).toMatchObject({ isValid: false, invalidReason: "invalid_exact_evm_recipient_mismatch" });
  });

  it("rejects a payer without enough USDC", async () => {
    chain.fund(PAYER.address, 1n);
    const req = requirements();
    const { body } = await post("/verify", await sign(req), req);
    expect(body).toMatchObject({ isValid: false, invalidReason: "invalid_exact_evm_insufficient_balance" });
  });

  it("rejects any asset other than Arc USDC", async () => {
    const req = requirements({ asset: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" }); // EURC
    const { body } = await post("/verify", await sign(req), req);
    expect(body).toMatchObject({ isValid: false, invalidReason: "unsupported_asset" });
  });
});

describe("settlement", () => {
  it("settles once, moves the USDC, and rejects the replayed nonce", async () => {
    const req = requirements();
    const p = await sign(req);
    const before = chain.balanceOf(PAY_TO);

    const first = await post("/settle", p, req);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ success: true, network: "eip155:5042002", payer: PAYER.address });
    expect(String(first.body.transaction)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(chain.balanceOf(PAY_TO) - before).toBe(10_000n);

    // Same signed authorization again: the nonce is spent on-chain.
    const verifyAgain = await post("/verify", p, req);
    expect(verifyAgain.body).toMatchObject({ isValid: false, invalidReason: "invalid_exact_evm_nonce_already_used" });
    const settleAgain = await post("/settle", p, req);
    expect(settleAgain.body.success).toBe(false);
    expect(chain.sent).toHaveLength(1);
  });

  it("refuses to settle a non-USDC asset without sending a transaction", async () => {
    const req = requirements({ asset: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" });
    const sentBefore = chain.sent.length;
    const { status, body } = await post("/settle", await sign(req), req);
    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, errorReason: "unsupported_asset" });
    expect(chain.sent.length).toBe(sentBefore);
  });
});
