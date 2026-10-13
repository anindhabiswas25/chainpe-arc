import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load .env from the contracts workspace and the repo root (root takes lower priority).
dotenv.config();
dotenv.config({ path: "../.env" });

// ============================================================================
// Secrets (NEVER hardcode — read from environment / gitignored .env)
// ============================================================================
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";

// Arc Testnet (see engineer-prompts/00-arc-spec.md).
const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.io";

// Only attach an account if a key is present, so `hardhat compile`/`test`
// work without any secrets configured.
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 1000 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 31337, hardfork: "cancun" },
    arcTestnet: {
      url: ARC_RPC_URL,
      chainId: 5042002,
      // Arc Testnet RPC can be slow to answer eth_sendRawTransaction under load.
      timeout: 120_000,
      accounts,
    },
  },
  // Arc Testnet's explorer is Blockscout with an etherscan-compatible API, so
  // hardhat-verify works through a custom chain. Blockscout needs no API key;
  // any non-empty string satisfies the plugin.
  etherscan: {
    apiKey: { arcTestnet: process.env.BLOCKSCOUT_API_KEY || "blockscout" },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://explorer.testnet.arc.io/api",
          browserURL: "https://explorer.testnet.arc.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
