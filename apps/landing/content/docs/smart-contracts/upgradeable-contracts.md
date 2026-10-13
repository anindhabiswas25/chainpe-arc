---
id: smart-contracts-upgradeable
title: Upgradeable Contracts
sidebar_position: 5
---

# Upgradeable Contracts

ChainPe provides UUPS-upgradeable versions of `ChainPeRegistry` and `PolicyVault` for production deployments (Arc Testnet today).

## Why UUPS?

The non-upgradeable contracts (used during local development) are simpler and have no upgrade risk. For a shared deployment, the ability to patch a critical bug without migrating every service registration is worth the extra complexity. The Arc Testnet deployment uses the UUPS-upgradeable variants.

UUPS (EIP-1822 / ERC-1967) was chosen over Transparent Proxy because:
- Upgrade logic lives in the implementation, not the proxy
- Smaller proxy bytecode
- Slightly lower gas for user calls

## Contracts

### ChainPeRegistryUpgradeable

**Solidity:** `contracts/contracts/ChainPeRegistryUpgradeable.sol`
**Inherits:** `Initializable`, `Ownable2StepUpgradeable`, `ReentrancyGuardUpgradeable`, `PausableUpgradeable`, `UUPSUpgradeable`

Identical semantics to `ChainPeRegistry` but with:
- `initialize()` instead of `constructor()`
- `_authorizeUpgrade()` restricted to `onlyOwner`
- All state behind the proxy (ERC-1967 storage slot)

### PolicyVaultUpgradeable

**Solidity:** `contracts/contracts/PolicyVaultUpgradeable.sol`

Same relationship to `PolicyVault`.

## Deployment process

```bash
cd contracts

# 1. Deploy the implementation
npx hardhat run scripts/deploy.ts --network arcTestnet
# This deploys ChainPeRegistryUpgradeable (impl) and an ERC1967Proxy pointing to it

# 2. The deploy script encodes initialize() and passes it to the proxy constructor:
# ERC1967Proxy(impl, abi.encodeCall(initialize, (token, recipient, fee, identityReg, owner)))

# 3. All interactions use the proxy address — never the implementation address directly
```

## Storage layout

The storage layout is critical for upgrades. Variables must never be reordered or removed — only new variables may be appended.

**ChainPeRegistryUpgradeable storage order:**
```
slot 0: feeToken (IERC20)
slot 1: feeRecipient (address)
slot 2: registrationFee (uint256)
slot 3: updateFee (uint256)
slot 4: identityRegistry (address)
slot 5: _services (mapping)
slot 6: _serviceKeys (array)
slot 7: _keyIndex (mapping)
```

## Upgrade process

```bash
# 1. Write and test the new implementation
# 2. Deploy the new implementation (not the proxy)
npx hardhat run scripts/deploy-new-impl.ts --network arcTestnet
# → outputs NEW_IMPL_ADDRESS

# 3. Owner (multisig) calls upgradeTo on the proxy
# Via Gnosis Safe: call proxy.upgradeToAndCall(NEW_IMPL_ADDRESS, "")
# Or via hardhat:
npx hardhat run scripts/upgrade.ts --network arcTestnet

# 4. Verify the new implementation
npx hardhat verify --network arcTestnet NEW_IMPL_ADDRESS
```

## Ownership transfer to multisig

After deploying, transfer ownership to a multisig:

```bash
# Deploy a multisig on Arc Testnet first, then:
SAFE_ADDRESS=0xYourMultisig npm run transfer-ownership
# Then, from the multisig, call acceptOwnership() on each proxy
```

The Ownable2Step pattern requires the new owner to explicitly accept before the transfer completes. This prevents accidental ownership loss.

## ERC-8004 registries

The three ERC-8004 registries (Identity, Reputation, Validation) are also deployed behind UUPS proxies. They follow the same pattern. The proxy addresses are what clients should use.
