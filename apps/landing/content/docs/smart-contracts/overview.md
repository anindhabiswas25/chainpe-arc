---
id: smart-contracts-overview
title: Smart Contracts Overview
sidebar_position: 1
slug: /smart-contracts/overview
---

# Smart Contracts

All ChainPe contracts are written in Solidity 0.8.28 and use OpenZeppelin libraries.

## Deployments

ChainPe contracts are **live on Arc Testnet** (deployed 2026-10-13). Use the **proxy** addresses. Each address links to `https://explorer.testnet.arc.io/address/<address>`.

| Contract | Env var | Arc Testnet address |
|---|---|---|
| ChainPeRegistry (proxy) | `CHAINPE_REGISTRY_ADDRESS` | [`0x79c7a22993A40A3c88355b737e6F608c6610c395`](https://explorer.testnet.arc.io/address/0x79c7a22993A40A3c88355b737e6F608c6610c395) |
| PolicyVault (proxy) | `POLICY_VAULT_ADDRESS` | [`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`](https://explorer.testnet.arc.io/address/0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81) |
| ChainPeTimelock (48h) | — | [`0x5071794F30C32604Be115c00Ed041c403fB2f302`](https://explorer.testnet.arc.io/address/0x5071794F30C32604Be115c00Ed041c403fB2f302) |
| ERC-8004 IdentityRegistry | `ERC8004_IDENTITY_REGISTRY` | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://explorer.testnet.arc.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 ReputationRegistry | `ERC8004_REPUTATION_REGISTRY` | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://explorer.testnet.arc.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| ERC-8004 ValidationRegistry | — | [`0x8004Cb1BF31DAf7788923b405b754f57acEB4272`](https://explorer.testnet.arc.io/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272) |

The ERC-8004 registries are **Arc's canonical deployments** (reference implementation v2.0.0, listed in the Arc docs and shared with other Arc agents). ChainPe uses them instead of deploying its own, and the SDK, CLI and dashboard default to them.

Implementations: ChainPeRegistryUpgradeable `0xE528F6731D345634d98B408475A1e6A4b8242eDB`, PolicyVaultUpgradeable `0xcebEd51c2D30E4053A387eAD80c43a5dD03343f1`. The registry was deployed at block `66993614` (use it as an indexer start block) and charges a **1 USDC** registration fee.

Every package defaults to these addresses, exported as `ARC_TESTNET_CONTRACTS` and `ARC_TESTNET_ERC8004` from `@chainpearc/sdk/arc`; the env vars in the table override them. To run your own copies, use `cd contracts && npm run deploy:arc-testnet` and `npm run deploy:policyvault`. The repository's `docs/DEPLOYMENTS.md` holds the same table plus verification status and the transactions from the end-to-end launch run.

## Network configuration

| Network | Chain ID | USDC Address | Explorer |
|---|---|---|---|
| Arc Testnet (`arc-testnet`) | 5042002 | `0x3600000000000000000000000000000000000000` (ERC-20 interface, 6 decimals; also the native gas token) | [explorer.testnet.arc.io](https://explorer.testnet.arc.io) |

## Source files

| Contract | Source |
|---|---|
| ChainPeRegistry | `contracts/contracts/ChainPeRegistryUpgradeable.sol` (UUPS, behind an ERC-1967 proxy) |
| PolicyVault | `contracts/contracts/PolicyVaultUpgradeable.sol` (UUPS, behind an ERC-1967 proxy) |
| ChainPeTimelock | `contracts/contracts/governance/ChainPeTimelock.sol` |
| IdentityRegistryUpgradeable | `contracts/contracts/erc8004/IdentityRegistryUpgradeable.sol` |
| ReputationRegistryUpgradeable | `contracts/contracts/erc8004/ReputationRegistryUpgradeable.sol` |
| ValidationRegistryUpgradeable | `contracts/contracts/erc8004/ValidationRegistryUpgradeable.sol` |

## Detailed references

- [ChainPeRegistry](./chainpe-registry.md) — service marketplace, events, access control
- [PolicyVault](./policy-vault.md) — gasless spending policies
- [Upgradeable Contracts](./upgradeable-contracts.md) — UUPS proxy pattern and upgrade process
