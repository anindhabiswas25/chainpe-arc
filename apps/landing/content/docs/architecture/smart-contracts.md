---
id: architecture-smart-contracts
title: Smart Contract Architecture
sidebar_position: 3
---

# Smart Contract Architecture

ChainPe's on-chain layer consists of five groups of contracts deployed on Arc Testnet.

## Contract groups

### 1. ChainPeRegistry

The service marketplace. Providers register services; agents discover them.

- `ChainPeRegistryUpgradeable.sol` — UUPS-upgradeable, deployed on Arc Testnet behind an ERC-1967 proxy at `0x79c7a22993A40A3c88355b737e6F608c6610c395`

**Inherits:** `Ownable2Step`, `ReentrancyGuard`, `Pausable`

**Key interactions:**
- Providers call `register(ServiceInput)` — requires USDC fee approval
- Agents call `getServices(offset, limit)` or read via events for discovery
- Owner calls `setRegistrationFee()`, `pause()`, `setIdentityRegistry()`

### 2. ERC-8004 Registries

Three UUPS-upgradeable registries for portable agent identity and reputation:

- `IdentityRegistryUpgradeable.sol` — ERC-721 NFT per agent
- `ReputationRegistryUpgradeable.sol` — scored feedback per agentId
- `ValidationRegistryUpgradeable.sol` — third-party attestations

**Key interactions:**
- Providers call `IdentityRegistry.register(agentURI)` to mint an identity
- Clients call `ReputationRegistry.giveFeedback(agentId, score, endpoint, tag)` after paid calls
- Anyone reads `ReputationRegistry` for discovery ranking

### 3. PolicyVault

Programmable, gasless spending policy.

- `PolicyVaultUpgradeable.sol` — UUPS-upgradeable, deployed on Arc Testnet behind an ERC-1967 proxy at `0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`

**Inherits:** `EIP712`, `ReentrancyGuard`, `Ownable`, `Pausable`

**Key interactions:**
- Owners call `deposit()`, `setPolicy()`, `setAllowlist()`, `revokeSession()`
- Agents call `previewSpend()` (view) then sign EIP-712 off-chain
- Relayers call `spend()` with the agent's signature

### 4. Mocks (testing only)

- `MockUSDC.sol` — mintable ERC-20 for local testing

## Upgrade strategy

ChainPeRegistry and PolicyVault use the UUPS pattern (the only variants in the repo; tests deploy them behind a proxy too):

1. Deploy the implementation contract
2. Deploy `ERC1967Proxy(impl, initCalldata)`
3. All interactions go through the proxy address
4. Owner (multisig) can call `upgradeTo(newImpl)` on the proxy

The storage layout is documented in each contract and must not be reordered between upgrades (append-only).

## Contract interaction diagram

```mermaid
graph LR
    USDC["USDC\n(ERC-20)"] -->|"safeTransferFrom"| REG["ChainPeRegistry"]
    USDC -->|"safeTransfer"| PV["PolicyVault"]
    REG -->|"reads agentId"| ID["IdentityRegistry"]
    PV -->|"EIP-712 domain"| PV
```

## Test coverage

Contract tests covering:

- `ChainPeRegistry`: register/update/deregister, fee collection, pagination, access control, pause/unpause
- `PolicyVault`: per-call cap, daily cap, total budget, expiry, allowlist, session revocation, nonce replay protection
- ERC-8004: identity minting, reputation feedback, self-feedback blocking
- Upgradeable variants: initialization, UUPS upgrade authorization
