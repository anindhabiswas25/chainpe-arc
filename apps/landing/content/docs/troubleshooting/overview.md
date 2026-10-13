---
id: troubleshooting-overview
title: Troubleshooting Overview
sidebar_position: 1
---

# Troubleshooting

Quick links to common issues:

- [Common Issues](./common-issues.md) — wrong chain, no USDC for gas, facilitator unreachable, and more
- [FAQ](../faq.md) — frequently asked questions

## Getting help

- **Discord:** [discord.gg/chainpe](https://discord.gg/chainpe)
- **Arc Testnet explorer:** [explorer.testnet.arc.io](https://explorer.testnet.arc.io)

## Quick diagnostic checklist

Before filing an issue, run through:

1. Is your `CHAINPE_PRIVATE_KEY` valid? Check with `chainpe status`.
2. Do you have USDC on Arc Testnet? Get testnet USDC from [faucet.circle.com](https://faucet.circle.com/) (select Arc Testnet). USDC is also the gas token on Arc.
3. Is your facilitator up? `curl "$CHAINPE_FACILITATOR_URL/health"` (see [Self-hosting the facilitator](../self-hosting/facilitator.md))
4. Is the indexer up? `curl "$INDEXER_URL/health"`
5. Is the network set correctly? Use `network: 'arc-testnet'`.
6. Did you override a contract address? Unset `CHAINPE_REGISTRY_ADDRESS` / `POLICY_VAULT_ADDRESS` to fall back to the live deployment (registry `0x79c7a22993A40A3c88355b737e6F608c6610c395`, see [Deployments](../smart-contracts/overview.md#deployments))
